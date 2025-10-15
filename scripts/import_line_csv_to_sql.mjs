#!/usr/bin/env node
/**
 * import_line_csv_to_sql.mjs
 * Usage:
 *   node scripts/import_line_csv_to_sql.mjs input.csv output.sql [--no-upload]
 *
 * Reads a LINE export style CSV with columns:
 *   お題,回答,回答者ID,回答者,日付,回答ID,...
 *
 * Behavior:
 *  - Groups rows by お題 (topic raw value).
 *  - If お題 starts with http/https => treat as image topic:
 *      * Downloads image, resizes (max width 1280, auto height) via sharp, converts to webp.
 *      * Uploads to Supabase Storage (S3 compatible) using env:
 *          STORAGE_ENDPOINT, STORAGE_ID, STORAGE_ACCESS_KEY, STORAGE_BUCKET
 *      * Creates topic row: title='写真', image=<public_url>, source_image=<original_url>
 *  - Else creates text topic: title=<お題> (image/source_image NULL).
 *  - Creates / upserts profiles (by line_id=回答者ID) into profiles(name,line_id).
 *      If you add a UNIQUE INDEX on profiles(line_id) this script uses ON CONFLICT.
 *  - Generates idempotent SQL:
 *      * Profiles inserted with ON CONFLICT(line_id) DO UPDATE SET name=EXCLUDED.name.
 *      * Topics inserted with conditional SELECT WHERE NOT EXISTS to avoid duplicates.
 *      * Answers inserted via SELECT ... FROM topics WHERE matching (title or source_image) AND NOT EXISTS duplicate.
 *
 * Notes:
 *  - Does not create votes/comments.
 *  - Assumes migrations already applied (profiles/topics/answers tables exist and pgcrypto extension).
 *  - Adds optional DDL for unique index on profiles(line_id) if missing.
 *
 * Security:
 *  - Avoid committing .env.local with secrets in VCS.
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v5 as uuidv5 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables (.env.local preferred). We attempt multiple candidate paths to be robust
const candidateEnvFiles = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(__dirname, '..', '.env.local'),
  path.resolve(process.cwd(), '.env'),
];
for (const p of candidateEnvFiles) {
  try {
    if (fs.existsSync(p)) {
      const res = dotenv.config({ path: p });
      if (!res.error) break; // stop after first successful load
    }
  } catch {
    /* ignore */
  }
}

// Namespace UUID for deterministic profile IDs (randomly chosen, but fixed literal)
const PROFILE_NAMESPACE = '3b2c5d4c-9d03-4af1-8cde-9a3fb7319a44';

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    'Usage: node scripts/import_line_csv_to_sql.mjs input.csv output.sql [--no-upload]'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 2) usage();
const inputPath = args[0];
const outputPath = args[1];
const noUpload = args.includes('--no-upload');
const compact = args.includes('--compact');
// default chunk size lines (0 = no split)
let chunkSize = 0;
for (const a of args) {
  if (a.startsWith('--chunk-size=')) {
    const v = Number(a.split('=')[1]);
    if (!Number.isNaN(v) && v > 0) chunkSize = v;
  }
}

if (!fs.existsSync(inputPath)) usage(`Input CSV not found: ${inputPath}`);

// Env for storage
const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT;
const STORAGE_ID = process.env.STORAGE_ID; // access key id
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY; // secret
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'images';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const projectRef = SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0];

let s3 = null;
if (!noUpload) {
  if (!STORAGE_ENDPOINT || !STORAGE_ID || !STORAGE_ACCESS_KEY) {
    console.error(
      'Missing storage env vars. Use --no-upload if you only want SQL with placeholders.'
    );
    process.exit(1);
  }
  s3 = new S3Client({
    region: 'us-east-1',
    endpoint: STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: STORAGE_ID,
      secretAccessKey: STORAGE_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

function toISODate(d) {
  try {
    if (!d) return new Date().toISOString();
    const trimmed = d.trim();
    if (!trimmed) return new Date().toISOString();
    // format YYYY/MM/DD (allow single digit month/day variants too)
    if (/^\d{4}\/[0-9]{1,2}\/[0-9]{1,2}$/.test(trimmed)) {
      const [y, m, day] = trimmed.split('/').map(Number);
      const iso = new Date(Date.UTC(y, m - 1, day, 0, 0, 0));
      if (isNaN(iso.getTime())) return new Date().toISOString();
      return iso.toISOString();
    }
    const t = Date.parse(trimmed);
    if (Number.isNaN(t)) return new Date().toISOString();
    return new Date(t).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function esc(str) {
  return str.replace(/'/g, "''");
}

function normalizeText(str) {
  return str.replace(/\r?\n/g, '\n').trim();
}

async function downloadAndResize(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${url} ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // basic content sniff (optional)
  let image = sharp(buf).rotate();
  const meta = await image.metadata();
  if (meta.width && meta.width > 1280) {
    image = image.resize({ width: 1280 });
  }
  const webp = await image.webp({ quality: 82 }).toBuffer();
  return webp;
}

async function uploadImage(buffer, originalUrl) {
  // deterministic hash for stable path
  const hash = crypto
    .createHash('sha256')
    .update(originalUrl)
    .digest('hex')
    .slice(0, 32);
  // store under images/<hash>.webp (no date directories per requirements)
  const objectPath = `images/${hash}.webp`;
  const put = new PutObjectCommand({
    Bucket: STORAGE_BUCKET,
    Key: objectPath,
    Body: buffer,
    ContentType: 'image/webp',
    CacheControl: 'public,max-age=31536000,immutable',
  });
  await s3.send(put);
  const publicUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/${objectPath}`;
  return { objectPath, publicUrl };
}

async function main() {
  const csvRaw = fs.readFileSync(inputPath, 'utf8');
  const records = [];
  await new Promise((resolve, reject) => {
    const parser = parse(csvRaw, {
      relaxColumnCount: true,
      skipEmptyLines: true,
    });
    parser.on('readable', () => {
      let r;
      while ((r = parser.read()) !== null) records.push(r);
    });
    parser.on('error', reject);
    parser.on('end', resolve);
  });

  // Expect header? If first row includes known header label start remove it
  if (records.length && (records[0][0] || '').includes('お題')) {
    // heuristic: if header contains 'お題' and '回答者'
    if (records[0].join(',').includes('回答者')) records.shift();
  }

  const rows = records
    .map(cols => ({
      rawTopic: (cols[0] || '').trim(),
      answerText: normalizeText(String(cols[1] || '').trim()),
      lineUserId: String(cols[2] || '').trim(),
      displayName: String(cols[3] || '').trim(),
      dateRaw: String(cols[4] || '').trim(),
      answerId: (cols[5] || '').trim() || null,
    }))
    .filter(r => r.answerText);

  // Build maps
  const profileMap = new Map(); // lineUserId -> { id(uuid), name, lineUserId }
  for (const r of rows) {
    if (!r.lineUserId) continue;
    if (!profileMap.has(r.lineUserId)) {
      const pid = uuidv5(r.lineUserId, PROFILE_NAMESPACE); // deterministic
      profileMap.set(r.lineUserId, {
        id: pid,
        name: r.displayName || '名無し',
        line_id: r.lineUserId,
      });
    } else {
      const existing = profileMap.get(r.lineUserId);
      if (r.displayName && existing.name !== r.displayName) {
        existing.name = r.displayName; // last wins
      }
    }
  }

  // Topic aggregation
  const topicMap = new Map(); // key -> { type: 'text'|'image', raw, title, image?, source_image?, anyDate }
  for (const r of rows) {
    const isImage = /^https?:\/\//i.test(r.rawTopic);
    const key = isImage ? `img:${r.rawTopic}` : `txt:${r.rawTopic}`;
    if (!topicMap.has(key)) {
      topicMap.set(key, {
        type: isImage ? 'image' : 'text',
        raw: r.rawTopic,
        title: isImage ? '写真' : r.rawTopic,
        source_image: isImage ? r.rawTopic : null,
        image: null,
        anyDate: r.dateRaw,
      });
    }
  }

  // Upload images (if enabled)
  if (!noUpload) {
    const failedImages = [];
    for (const [, t] of topicMap) {
      if (t.type === 'image' && !t.image) {
        try {
          const buf = await downloadAndResize(t.source_image);
          const { publicUrl } = await uploadImage(buf, t.source_image);
          t.image = publicUrl;
          // brief rate limit safety to avoid overwhelming storage
          await new Promise(r => setTimeout(r, 120));
        } catch (e) {
          failedImages.push({ url: t.source_image, error: e });
          console.error(
            'Image upload failed for',
            t.source_image,
            e?.message || e
          );
        }
      }
    }
    if (failedImages.length) {
      console.error(
        `\nERROR: ${failedImages.length} image(s) failed to upload. Aborting so that missing image URLs do not enter the SQL.`
      );
      process.exit(2);
    }
  } else {
    // Fill placeholder path if skipping upload
    for (const t of topicMap.values()) {
      if (t.type === 'image') t.image = '<REPLACE_WITH_IMAGE_URL>';
    }
  }

  // Build SQL parts
  const statements = [];
  statements.push('-- Generated by import_line_csv_to_sql.mjs');
  statements.push('BEGIN;');
  statements.push(
    '-- Ensure unique index on profiles(line_id) (optional but recommended)'
  );
  statements.push(
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='profiles_line_id_idx') THEN CREATE UNIQUE INDEX profiles_line_id_idx ON profiles(line_id); END IF; END $$;"
  );
  // Helpful index for image source lookup & update (idempotent)
  statements.push(
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='topics_source_image_idx') THEN CREATE INDEX topics_source_image_idx ON topics(source_image); END IF; END $$;"
  );

  // Profiles
  statements.push('-- Upsert profiles');
  if (profileMap.size) {
    const profileValues = [];
    for (const p of profileMap.values()) {
      profileValues.push(
        `  ('${p.id}'::uuid, '${esc(p.name)}', '${esc(p.line_id)}')`
      );
    }
    const profileStmt =
      'INSERT INTO profiles (id, name, line_id) VALUES\n' +
      profileValues.join(',\n') +
      '\nON CONFLICT (line_id) DO UPDATE SET name=EXCLUDED.name;';
    statements.push(profileStmt);
  }

  // Topics (idempotent insert) - use separate statements for clarity
  statements.push('-- Topics');
  for (const t of topicMap.values()) {
    const createdAt = toISODate(t.anyDate);
    if (t.type === 'image') {
      statements.push(`-- image topic from ${esc(t.source_image)}`);
      // 2-step upsert semantics for image topics:
      // 1) UPDATE existing row (if any) to ensure image column is populated (idempotent & fixes earlier null runs)
      // 2) INSERT if still not existing.
      if (compact) {
        statements.push(
          `UPDATE topics SET image='${esc(t.image)}' WHERE source_image='${esc(t.source_image)}' AND (image IS NULL OR image!='${esc(t.image)}');`
        );
        statements.push(
          `INSERT INTO topics (title,image,source_image,created_at) SELECT '写真','${esc(t.image)}','${esc(t.source_image)}','${createdAt}' WHERE NOT EXISTS (SELECT 1 FROM topics WHERE source_image='${esc(t.source_image)}');`
        );
      } else {
        statements.push(
          `UPDATE topics\nSET image='${esc(t.image)}'\nWHERE source_image='${esc(t.source_image)}'\n  AND (image IS NULL OR image!='${esc(t.image)}');`
        );
        statements.push(
          `INSERT INTO topics (title, image, source_image, created_at)\nSELECT '写真', '${esc(t.image)}', '${esc(t.source_image)}', '${createdAt}'\nWHERE NOT EXISTS (SELECT 1 FROM topics WHERE source_image='${esc(t.source_image)}');`
        );
      }
    } else {
      statements.push(`-- text topic: ${esc(t.raw)}`);
      const stmt = compact
        ? `INSERT INTO topics (title,created_at) SELECT '${esc(t.title)}','${createdAt}' WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title='${esc(t.title)}' AND image IS NULL);`
        : `INSERT INTO topics (title, created_at)\nSELECT '${esc(t.title)}', '${createdAt}'\nWHERE NOT EXISTS (SELECT 1 FROM topics WHERE title='${esc(t.title)}' AND image IS NULL);`;
      statements.push(stmt);
    }
  }

  // Answers
  statements.push('-- Answers');
  for (const r of rows) {
    const prof = profileMap.get(r.lineUserId);
    if (!prof) continue;
    const isImage = /^https?:\/\//i.test(r.rawTopic);
    const createdAt = toISODate(r.dateRaw);
    const matchClause = isImage
      ? `t.source_image='${esc(r.rawTopic)}'`
      : `t.title='${esc(r.rawTopic)}' AND t.image IS NULL`;
    const answerText = esc(normalizeText(r.answerText));
    const stmt = compact
      ? `INSERT INTO answers (topic_id,profile_id,text,created_at) SELECT t.id,'${prof.id}'::uuid,'${answerText}','${createdAt}' FROM topics t WHERE ${matchClause} AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.text='${answerText}' AND a.profile_id='${prof.id}'::uuid);`
      : `INSERT INTO answers (topic_id, profile_id, text, created_at)\nSELECT t.id, '${prof.id}'::uuid, '${answerText}', '${createdAt}'\nFROM topics t\nWHERE ${matchClause}\n  AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.text='${answerText}' AND a.profile_id='${prof.id}'::uuid);`;
    statements.push(stmt);
  }
  statements.push('COMMIT;');

  // Chunking mode: chunkSize counts statements (not lines) for more predictable splitting.
  if (chunkSize > 0) {
    // Statement list (exclude initial global BEGIN/COMMIT for per-chunk wrapping)
    const core = statements.filter(s => s !== 'BEGIN;' && s !== 'COMMIT;');
    const base = outputPath.endsWith('.sql')
      ? outputPath.slice(0, -4)
      : outputPath;
    const files = [];
    let part = 1;
    for (let i = 0; i < core.length; i += chunkSize) {
      const slice = core.slice(i, i + chunkSize);
      const fname = `${base}.part${String(part).padStart(2, '0')}.sql`;
      const content = ['BEGIN;', ...slice, 'COMMIT;'].join('\n') + '\n';
      fs.writeFileSync(fname, content, 'utf8');
      files.push(fname);
      part += 1;
    }
    console.log(
      `Done. Wrote ${files.length} chunk files (statements per chunk=${chunkSize}).`
    );
  } else {
    const content = statements.join('\n') + '\n';
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(
      `Done. Wrote SQL to ${outputPath} (statements=${statements.length}).`
    );
  }
  if (!noUpload)
    console.log('Images uploaded to storage (images/<hash>.webp).');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
