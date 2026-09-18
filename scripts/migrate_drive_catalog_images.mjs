#!/usr/bin/env node
/**
 * migrate_drive_catalog_images.mjs
 *
 * One-shot local migration: catalog Drive URLs → Supabase Storage,
 * without creating empty topics. Reuses topics.image when source_image already matches.
 *
 * Preferred (no Google hammering): supply a Drive folder Zip and match by filename.
 *
 * Usage:
 *   node scripts/migrate_drive_catalog_images.mjs input.csv mapping.csv --from-zip=./images.zip
 *   node scripts/migrate_drive_catalog_images.mjs input.csv mapping.csv --from-zip=./images.zip --apply --limit=3
 *   node scripts/migrate_drive_catalog_images.mjs input.csv mapping.csv --from-zip=./images.zip --apply --update-source-image
 *
 * Input CSV: columns like 項番/ファイル名 + URL (Drive download URL).
 *
 * Default is dry-run: DB classify + Zip match report (no upload).
 * --from-zip=PATH  use local Zip bytes instead of fetching Drive (folder prefix OK)
 * --from-dir=PATH  same, but already-extracted directory
 * --apply          upload missing images
 * --limit=N        cap uploads on --apply
 * --update-source-image  rewrite topics.source_image to Storage public URL
 *
 * Requires .env.local: VITE_SUPABASE_URL, SUPABASE_SECRET_KEY
 * Optional: STORAGE_BUCKET (images), STORAGE_FOLDER (line-sync)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateEnvFiles = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(__dirname, '..', '.env.local'),
  path.resolve(process.cwd(), '.env'),
];
for (const p of candidateEnvFiles) {
  if (fs.existsSync(p)) {
    const res = dotenv.config({ path: p });
    if (!res.error) break;
  }
}

const THUMBNAIL_MAX_DIMENSION = 800;
const JPEG_QUALITY = 85;

function usage(msg) {
  if (msg) console.error(msg);
  console.error(`Usage:
  node scripts/migrate_drive_catalog_images.mjs <input.csv> <mapping.csv> [options]

Options:
  --from-zip=PATH   Prefer local Zip files (match by filename / LINE_ALBUM tail id)
  --from-dir=PATH   Prefer local extracted folder
  --apply           Upload missing images to Storage
  --limit=N         Cap uploads
  --update-source-image  Update topics.source_image to Storage URL when reusing/uploading`);
  process.exit(1);
}

const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const apply = args.includes('--apply');
const updateSourceImage = args.includes('--update-source-image');
let downloadLimit = Infinity;
let fromZip = null;
let fromDir = null;
for (const a of args) {
  if (a.startsWith('--limit=')) {
    const v = Number(a.slice('--limit='.length));
    if (!Number.isFinite(v) || v < 0) usage(`Invalid --limit: ${a}`);
    downloadLimit = v;
  } else if (a.startsWith('--from-zip=')) {
    fromZip = a.slice('--from-zip='.length);
  } else if (a.startsWith('--from-dir=')) {
    fromDir = a.slice('--from-dir='.length);
  }
}

if (positional.length < 2) usage();
const inputPath = positional[0];
const mappingPath = positional[1];
if (!fs.existsSync(inputPath)) usage(`Input not found: ${inputPath}`);
if (fromZip && !fs.existsSync(fromZip)) usage(`Zip not found: ${fromZip}`);
if (fromDir && !fs.existsSync(fromDir)) usage(`Dir not found: ${fromDir}`);

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'images';
const STORAGE_FOLDER = (process.env.STORAGE_FOLDER || 'line-sync')
  .replace(/\/+/g, '/')
  .replace(/^\//, '')
  .replace(/\/$/, '');

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function isOwnStoragePublicUrl(url) {
  try {
    const parsed = new URL(url);
    const expectedHost = new URL(SUPABASE_URL).host;
    if (parsed.host !== expectedHost) return false;
    const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    return parsed.pathname.startsWith(prefix);
  } catch {
    return false;
  }
}

/** Match LINE_ALBUM mojibake: …_250111_147.jpg */
function fileTailKey(name) {
  const m = String(name).match(/(_\d{6}_\d+)\.([a-zA-Z0-9]+)$/i);
  if (!m) return null;
  return `${m[1].toLowerCase()}.${m[2].toLowerCase()}`;
}

function loadCatalogEntries(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  const entries = [];

  if (ext === '.csv') {
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
    if (records.length && typeof records[0] === 'object') {
      const keys = Object.keys(records[0]);
      const urlKey =
        keys.find(k => /^(url|source_url|sourceimage|source_image|b)$/i.test(k.trim())) ||
        keys.find(k => {
          const sample = records.find(r => isHttpUrl(String(r[k] ?? '')));
          return Boolean(sample);
        });
      const labelKey =
        keys.find(k =>
          /^(name|label|filename|ファイル名|項番|a|title)$/i.test(k.trim()),
        ) || null;
      if (!urlKey) {
        throw new Error(
          'CSV has headers but no URL column (expected url / source_url / …)',
        );
      }
      for (const row of records) {
        const url = String(row[urlKey] ?? '').trim();
        if (!isHttpUrl(url)) continue;
        const label = labelKey ? String(row[labelKey] ?? '').trim() : '';
        entries.push({ sourceUrl: url, label });
      }
      return dedupeEntries(entries);
    }
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.includes('\t')) {
      const [a, b] = trimmed.split('\t');
      if (isHttpUrl(b)) entries.push({ sourceUrl: b.trim(), label: (a || '').trim() });
      else if (isHttpUrl(a)) entries.push({ sourceUrl: a.trim(), label: (b || '').trim() });
      continue;
    }
    if (isHttpUrl(trimmed)) {
      entries.push({ sourceUrl: trimmed, label: '' });
    }
  }
  return dedupeEntries(entries);
}

function dedupeEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    if (seen.has(e.sourceUrl)) continue;
    seen.add(e.sourceUrl);
    out.push(e);
  }
  return out;
}

function walkFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, out);
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

/**
 * Local file index from an extracted directory or a Zip (no extract; read via unzip -p).
 * @returns {{ kind: 'dir'|'zip', zipPath?: string, byBase: Map<string,string>, byTail: Map<string,string>, size: number }}
 */
function buildDirFileIndex(rootDir) {
  const byBase = new Map();
  const byTail = new Map();
  for (const full of walkFiles(rootDir)) {
    const base = path.basename(full);
    if (!byBase.has(base)) byBase.set(base, full);
    const tail = fileTailKey(base);
    if (tail && !byTail.has(tail)) byTail.set(tail, full);
  }
  return { kind: 'dir', byBase, byTail, size: byBase.size };
}

function buildZipFileIndex(zipPath) {
  // unzip -Z1 mojibakes Japanese names; Python zipfile keeps Unicode.
  const py = `
import json, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
print(json.dumps([n for n in z.namelist() if not n.endswith('/')]))
`;
  const listingJson = execFileSync('python3', ['-c', py, zipPath], {
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
  });
  const entries = JSON.parse(listingJson);
  const byBase = new Map();
  const byTail = new Map();
  for (const ent of entries) {
    const base = path.basename(ent);
    if (!byBase.has(base)) byBase.set(base, ent);
    const tail = fileTailKey(base);
    if (tail && !byTail.has(tail)) byTail.set(tail, ent);
  }
  return { kind: 'zip', zipPath, byBase, byTail, size: byBase.size };
}

function resolveLocalFile(index, label) {
  if (!index || !label) return null;
  if (index.byBase.has(label)) {
    return { key: index.byBase.get(label), match: 'exact' };
  }
  const tail = fileTailKey(label);
  if (tail && index.byTail.has(tail)) {
    return { key: index.byTail.get(tail), match: 'tail' };
  }
  return null;
}

function readLocalBytes(index, resolved) {
  if (!resolved) throw new Error('no local file resolved');
  if (index.kind === 'dir') {
    return fs.readFileSync(resolved.key);
  }
  const py = `
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
sys.stdout.buffer.write(z.read(sys.argv[2]))
`;
  return execFileSync('python3', ['-c', py, index.zipPath, resolved.key], {
    maxBuffer: 30 * 1024 * 1024,
  });
}

function extFromContentType(contentType) {
  if (!contentType) return null;
  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  switch (normalized) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return null;
  }
}

function extFromFilename(name) {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  if (!m) return null;
  const e = m[1];
  if (e === 'jpeg') return 'jpg';
  return e;
}

function buildStoragePath(sourceUrl, extension) {
  const hash = crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 32);
  const sanitizedExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  return `${STORAGE_FOLDER}/${hash}.${sanitizedExt}`;
}

async function processImageBuffer(buffer, extension) {
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width && metadata.width > THUMBNAIL_MAX_DIMENSION) {
      return await sharp(buffer)
        .resize(THUMBNAIL_MAX_DIMENSION, null, { withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    }
    if (extension === 'webp') {
      return await sharp(buffer).webp({ quality: 80 }).toBuffer();
    }
  } catch (error) {
    console.warn('  sharp failed, using original bytes:', error.message || error);
  }
  return buffer;
}

async function findTopicBySourceImage(sourceUrl) {
  const { data, error } = await supabase
    .from('topics')
    .select('id, image, source_image')
    .eq('source_image', sourceUrl)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

async function uploadBufferForSourceUrl(sourceUrl, buffer, filenameHint) {
  const extension =
    extFromFilename(filenameHint) ||
    extFromContentType(null) ||
    'jpg';
  const processed = await processImageBuffer(buffer, extension);
  const storagePath = buildStoragePath(sourceUrl, extension === 'jpeg' ? 'jpg' : extension);
  const contentTypeOut =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
        ? 'image/webp'
        : extension === 'gif'
          ? 'image/gif'
          : 'image/jpeg';

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, processed, {
    contentType: contentTypeOut,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return { path: storagePath, publicUrl: data.publicUrl };
}

async function uploadFromSourceUrl(sourceUrl) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get('content-type');
  const extension = extFromContentType(contentType) || 'jpg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadBufferForSourceUrl(sourceUrl, buffer, `x.${extension}`);
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  let localIndex = null;
  if (fromZip) {
    const zipPath = path.resolve(fromZip);
    console.log(`Indexing zip (no extract): ${zipPath}`);
    localIndex = buildZipFileIndex(zipPath);
  } else if (fromDir) {
    localIndex = buildDirFileIndex(path.resolve(fromDir));
  }

  const entries = loadCatalogEntries(inputPath);
  if (!entries.length) {
    console.error('No http(s) URLs found in input');
    process.exit(1);
  }

  const missingLabels = entries.filter(e => !e.label).length;
  if (localIndex && missingLabels) {
    console.warn(
      `Warning: ${missingLabels} CSV row(s) have no filename label; Zip match needs 項番/ファイル名 column.`,
    );
  }

  console.log(
    `Loaded ${entries.length} unique URL(s). mode=${apply ? 'APPLY' : 'DRY-RUN'}` +
      (updateSourceImage ? ' update-source-image=ON' : '') +
      (Number.isFinite(downloadLimit) ? ` limit=${downloadLimit}` : '') +
      (localIndex
        ? ` localFiles=${localIndex.size} (${localIndex.kind})`
        : ' localFiles=none'),
  );
  console.log('Phase 1: classify against DB…');

  /** @type {Array<{ sourceUrl: string, label: string, kind: string, topic: object | null, local?: object | null, error?: string }>} */
  const classified = [];
  for (let i = 0; i < entries.length; i++) {
    const { sourceUrl, label } = entries[i];
    const n = `[${i + 1}/${entries.length}]`;
    process.stdout.write(`${n} classify… `);

    const local = resolveLocalFile(localIndex, label);

    if (isOwnStoragePublicUrl(sourceUrl)) {
      console.log('already_storage');
      classified.push({ sourceUrl, label, kind: 'already_storage', topic: null, local });
      continue;
    }

    try {
      const topic = await findTopicBySourceImage(sourceUrl);
      if (topic?.image) {
        console.log(`reused topic#${topic.id}`);
        classified.push({ sourceUrl, label, kind: 'reused', topic, local });
      } else if (topic) {
        console.log(`needs_upload (topic#${topic.id} image empty)`);
        classified.push({
          sourceUrl,
          label,
          kind: 'needs_download_fill_topic',
          topic,
          local,
        });
      } else {
        console.log('needs_upload');
        classified.push({ sourceUrl, label, kind: 'needs_download', topic: null, local });
      }
    } catch (error) {
      console.log(`ERROR ${error?.message || error}`);
      classified.push({
        sourceUrl,
        label,
        kind: 'classify_error',
        topic: null,
        local,
        error: error?.message || String(error),
      });
    }
  }

  const needUpload = classified.filter(
    c => c.kind === 'needs_download' || c.kind === 'needs_download_fill_topic',
  );
  const reusedCount = classified.filter(c => c.kind === 'reused').length;
  const alreadyCount = classified.filter(c => c.kind === 'already_storage').length;
  const classifyErrors = classified.filter(c => c.kind === 'classify_error').length;
  const fromLocal = needUpload.filter(c => c.local).length;
  const fromDrive = needUpload.length - fromLocal;

  console.log('\n=== Upload plan ===');
  console.log(`total URLs:                 ${entries.length}`);
  console.log(`reuse from DB (no upload):  ${reusedCount}`);
  console.log(`already Storage (no upload):${alreadyCount}`);
  console.log(`NEED upload:                ${needUpload.length}`);
  if (localIndex) {
    console.log(`  from Zip/dir (no Google): ${fromLocal}`);
    console.log(`  would hit Drive URL:      ${fromDrive}`);
  } else {
    console.log(`  (no --from-zip/--from-dir → all ${needUpload.length} would fetch Drive)`);
  }
  console.log(`classify errors:            ${classifyErrors}`);
  if (apply && Number.isFinite(downloadLimit)) {
    console.log(
      `this --apply will upload at most: ${Math.min(downloadLimit, needUpload.length)}`,
    );
  }
  console.log('====================\n');

  const rows = [
    [
      'source_url',
      'label',
      'public_url',
      'status',
      'topic_id',
      'storage_path',
      'local_match',
      'error',
    ],
  ];

  let reused = 0;
  let uploaded = 0;
  let uploadedLocal = 0;
  let uploadedDrive = 0;
  let skippedOwn = 0;
  let failed = 0;
  let deferred = 0;
  let uploadsDone = 0;

  for (const item of classified) {
    const { sourceUrl, label, kind, topic, local } = item;

    if (kind === 'classify_error') {
      failed += 1;
      rows.push([
        sourceUrl,
        label,
        '',
        'error',
        '',
        '',
        local?.match || '',
        item.error || 'classify failed',
      ]);
      continue;
    }

    if (kind === 'already_storage') {
      skippedOwn += 1;
      rows.push([sourceUrl, label, sourceUrl, 'already_storage', '', '', '', '']);
      continue;
    }

    if (kind === 'reused') {
      reused += 1;
      if (apply && updateSourceImage && topic.source_image !== topic.image) {
        const { error } = await supabase
          .from('topics')
          .update({ source_image: topic.image })
          .eq('id', topic.id);
        if (error) {
          failed += 1;
          rows.push([
            sourceUrl,
            label,
            topic.image,
            'error',
            String(topic.id),
            '',
            '',
            error.message,
          ]);
          continue;
        }
        rows.push([
          sourceUrl,
          label,
          topic.image,
          'reused_source_updated',
          String(topic.id),
          '',
          '',
          '',
        ]);
      } else {
        rows.push([sourceUrl, label, topic.image, 'reused', String(topic.id), '', '', '']);
      }
      continue;
    }

    // needs_download*
    if (!apply) {
      const status = local
        ? kind === 'needs_download_fill_topic'
          ? 'would_upload_from_local_fill_topic'
          : 'would_upload_from_local'
        : kind === 'needs_download_fill_topic'
          ? 'would_upload_from_drive_fill_topic'
          : 'would_upload_from_drive';
      rows.push([
        sourceUrl,
        label,
        '',
        status,
        topic ? String(topic.id) : '',
        '',
        local?.match || '',
        '',
      ]);
      continue;
    }

    if (uploadsDone >= downloadLimit) {
      deferred += 1;
      rows.push([
        sourceUrl,
        label,
        '',
        'deferred_limit',
        topic ? String(topic.id) : '',
        '',
        local?.match || '',
        `skipped by --limit=${downloadLimit}`,
      ]);
      continue;
    }

    const cap = Math.min(downloadLimit, needUpload.length);
    process.stdout.write(
      `upload ${uploadsDone + 1}/${cap} ${label || sourceUrl.slice(0, 40)}… `,
    );
    try {
      let stored;
      if (local?.key) {
        const buffer = readLocalBytes(localIndex, local);
        stored = await uploadBufferForSourceUrl(
          sourceUrl,
          buffer,
          label || path.basename(local.key),
        );
        uploadedLocal += 1;
        console.log(`ok local(${local.match}) ${stored.path}`);
      } else {
        stored = await uploadFromSourceUrl(sourceUrl);
        uploadedDrive += 1;
        console.log(`ok drive ${stored.path}`);
      }
      uploadsDone += 1;
      uploaded += 1;

      if (topic?.id) {
        const patch = { image: stored.publicUrl };
        if (updateSourceImage) patch.source_image = stored.publicUrl;
        const { error } = await supabase.from('topics').update(patch).eq('id', topic.id);
        if (error) throw error;
      }

      rows.push([
        sourceUrl,
        label,
        stored.publicUrl,
        topic
          ? local
            ? 'uploaded_local_filled_topic'
            : 'uploaded_drive_filled_topic'
          : local
            ? 'uploaded_local'
            : 'uploaded_drive',
        topic ? String(topic.id) : '',
        stored.path,
        local?.match || '',
        '',
      ]);
    } catch (error) {
      failed += 1;
      const message = error?.message || String(error);
      console.log(`ERROR ${message}`);
      rows.push([
        sourceUrl,
        label,
        '',
        'error',
        topic ? String(topic.id) : '',
        '',
        local?.match || '',
        message,
      ]);
    }
  }

  const out = rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n';
  fs.writeFileSync(mappingPath, out, 'utf8');

  console.log('\nDone.');
  console.log(
    `reused=${reused} uploaded=${uploaded} (local=${uploadedLocal} drive=${uploadedDrive}) already_storage=${skippedOwn} deferred=${deferred} failed=${failed}`,
  );
  console.log(`mapping written: ${mappingPath}`);
  if (!apply) {
    const zipArg = fromZip
      ? ` --from-zip=${fromZip}`
      : fromDir
        ? ` --from-dir=${fromDir}`
        : ' --from-zip=/path/to/images.zip';
    console.log(
      `\nDry-run only. Smoke-test:\n` +
        `  node scripts/migrate_drive_catalog_images.mjs ${inputPath} ${mappingPath}${zipArg} --apply --limit=3\n` +
        `Full:\n` +
        `  node scripts/migrate_drive_catalog_images.mjs ${inputPath} ${mappingPath}${zipArg} --apply --update-source-image`,
    );
  } else if (deferred > 0) {
    console.log(
      `${deferred} upload(s) deferred by --limit. Re-run --apply to continue.`,
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
