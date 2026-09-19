#!/usr/bin/env node
/**
 * Local image catalog uploader.
 *
 * Default drop zone: local-images/inbox/
 * Always normalizes to JPEG (max edge 800, quality 75, strip metadata),
 * uploads to Storage, then moves inbox files to local-images/done/<hash>.jpg
 * (same basename as the Storage object).
 *
 * Usage:
 *   pnpm upload:images
 *   pnpm upload:images -- --dry-run
 *   pnpm upload:images -- ./other.jpg
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SECRET_KEY
 *      STORAGE_BUCKET (default images), STORAGE_FOLDER (default line-sync)
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX_DIR = path.join(ROOT, 'local-images', 'inbox');
const DONE_DIR = path.join(ROOT, 'local-images', 'done');

dotenv.config({ path: path.join(ROOT, '.env.local'), quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const MAX_EDGE = 800;
const JPEG_QUALITY = 75;
/** Input only — everything is stored as .jpg */
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif']);

function usage(exitCode = 1) {
  console.error(`Usage: pnpm upload:images -- [--dry-run] [file-or-dir ...]

Default input: local-images/inbox/ (any names).
Always output JPEG: max edge ${MAX_EDGE}px, quality ${JPEG_QUALITY}, strip EXIF.
Upload to Storage, then move inbox → local-images/done/<hash>.jpg

Stdout: one publicUrl per line.
`);
  process.exit(exitCode);
}

function normalizeExt(ext) {
  const e = ext.replace(/^\./, '').toLowerCase();
  return e === 'jpeg' ? 'jpg' : e;
}

function isUnderDir(filePath, dir) {
  const rel = path.relative(dir, filePath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function collectImagePaths(inputs) {
  const out = [];
  for (const input of inputs) {
    const abs = path.resolve(input);
    const info = await stat(abs);
    if (info.isDirectory()) {
      const entries = await readdir(abs);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        const child = path.join(abs, name);
        const childStat = await stat(child);
        if (!childStat.isFile()) continue;
        const ext = normalizeExt(path.extname(name));
        if (ALLOWED_EXT.has(ext)) out.push(child);
      }
    } else if (info.isFile()) {
      const ext = normalizeExt(path.extname(abs));
      if (!ALLOWED_EXT.has(ext)) {
        throw new Error(`Unsupported file type: ${abs}`);
      }
      out.push(abs);
    } else {
      throw new Error(`Not a file or directory: ${abs}`);
    }
  }
  return [...new Set(out)].sort();
}

/** Always JPEG: max edge, quality 75, no metadata. */
async function toCatalogJpeg(buffer) {
  return sharp(buffer)
    .rotate() // honour EXIF orientation, then strip
    .resize(MAX_EDGE, MAX_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

function buildStoragePath(folder, contentHashHex) {
  const hash = contentHashHex.slice(0, 32);
  const cleanFolder = folder.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
  return `${cleanFolder}/${hash}.jpg`;
}

async function settleLocalFile(originalPath, processedBuffer, objectBasename) {
  await mkdir(DONE_DIR, { recursive: true });
  const donePath = path.join(DONE_DIR, objectBasename);

  if (isUnderDir(originalPath, INBOX_DIR)) {
    await writeFile(donePath, processedBuffer);
    if (path.resolve(originalPath) !== path.resolve(donePath)) {
      await unlink(originalPath);
    }
    return donePath;
  }

  const dest = path.join(path.dirname(originalPath), objectBasename);
  await writeFile(dest, processedBuffer);
  if (path.resolve(originalPath) !== path.resolve(dest)) {
    await unlink(originalPath);
  }
  return dest;
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  if (argv.includes('-h') || argv.includes('--help')) {
    usage(0);
  }

  const dryRun = argv.includes('--dry-run');
  const inputs = argv.filter((a) => a !== '--dry-run');
  const resolvedInputs = inputs.length > 0 ? inputs : [INBOX_DIR];

  await mkdir(INBOX_DIR, { recursive: true });
  await mkdir(DONE_DIR, { recursive: true });

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SECRET_KEY || '';
  const bucket = process.env.STORAGE_BUCKET || 'images';
  const folder = process.env.STORAGE_FOLDER || 'line-sync';

  if (!dryRun && (!supabaseUrl || !serviceKey)) {
    console.error('Need VITE_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local');
    process.exit(1);
  }

  const files = await collectImagePaths(resolvedInputs);
  if (files.length === 0) {
    console.error(
      `No image files found in ${resolvedInputs.join(', ')} ` +
        `(jpg/png/webp/gif/heic).\n` +
        `Drop files into ${path.relative(ROOT, INBOX_DIR)}/ then re-run.`,
    );
    process.exit(1);
  }

  const supabase =
    !dryRun &&
    createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  console.error(
    `Uploading ${files.length} file(s) as JPEG (max ${MAX_EDGE}px q${JPEG_QUALITY}) → ${bucket}/${folder}/` +
      (dryRun ? ' (dry-run)' : ''),
  );

  let ok = 0;
  let failed = 0;

  for (const file of files) {
    const raw = await readFile(file);
    let buffer;
    try {
      buffer = await toCatalogJpeg(raw);
    } catch (error) {
      console.error(`FAIL  ${file}: process ${error.message ?? error}`);
      failed += 1;
      continue;
    }

    const contentHash = createHash('sha256').update(buffer).digest('hex');
    const storagePath = buildStoragePath(folder, contentHash);
    const objectBasename = path.basename(storagePath);
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;

    if (dryRun) {
      console.error(
        `dry-run  ${path.basename(file)} → ${storagePath}` +
          (isUnderDir(file, INBOX_DIR) ? ` → done/${objectBasename}` : ''),
      );
      console.log(publicUrl);
      ok += 1;
      continue;
    }

    const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (error) {
      console.error(`FAIL  ${file}: ${error.message}`);
      failed += 1;
      continue;
    }

    const settled = await settleLocalFile(file, buffer, objectBasename);
    console.error(`ok    ${path.basename(file)} → ${storagePath} (local ${path.relative(ROOT, settled)})`);
    console.log(publicUrl);
    ok += 1;
  }

  console.error(`Done. ok=${ok} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
