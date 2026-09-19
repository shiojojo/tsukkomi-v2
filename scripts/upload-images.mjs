#!/usr/bin/env node
/**
 * Local image catalog uploader (macOS only).
 *
 * Uses system `sips` (no npm native / postinstall packages) to normalize
 * to JPEG, then uploads to Supabase Storage.
 *
 * Default drop zone: local-images/inbox/
 * After success: move to local-images/done/<hash>.jpg
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
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INBOX_DIR = path.join(ROOT, 'local-images', 'inbox');
const DONE_DIR = path.join(ROOT, 'local-images', 'done');

dotenv.config({ path: path.join(ROOT, '.env.local'), quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const MAX_EDGE = 800;
/** sips formatOptions: 0–100 (similar ballpark to former sharp q75) */
const JPEG_QUALITY = 75;
/** Input only — everything is stored as .jpg. WebP is omitted (sips cannot reliably read it). */
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif']);

function usage(exitCode = 1) {
  console.error(`Usage: pnpm upload:images -- [--dry-run] [file-or-dir ...]

macOS only (system sips — no sharp / npm postinstall).
Default input: local-images/inbox/
Always JPEG: max edge ${MAX_EDGE}px, quality ${JPEG_QUALITY}.
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

async function assertMacSips() {
  if (process.platform !== 'darwin') {
    throw new Error('upload:images requires macOS (uses system sips for supply-chain-safe processing).');
  }
  try {
    await execFileAsync('/usr/bin/sips', ['-h']);
  } catch {
    throw new Error('sips not found at /usr/bin/sips (expected on macOS).');
  }
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
        throw new Error(`Unsupported file type: ${abs} (allowed: ${[...ALLOWED_EXT].join(', ')})`);
      }
      out.push(abs);
    } else {
      throw new Error(`Not a file or directory: ${abs}`);
    }
  }
  return [...new Set(out)].sort();
}

/**
 * Always JPEG via sips: max edge MAX_EDGE, quality JPEG_QUALITY.
 * Aspect ratio preserved (-Z). Runs only on the source file path (no npm image libs).
 */
async function toCatalogJpeg(sourcePath) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'tsukkomi-img-'));
  const outPath = path.join(tmp, 'out.jpg');
  try {
    await execFileAsync('/usr/bin/sips', [
      '-Z',
      String(MAX_EDGE),
      '-s',
      'format',
      'jpeg',
      '-s',
      'formatOptions',
      String(JPEG_QUALITY),
      sourcePath,
      '--out',
      outPath,
    ]);
    return await readFile(outPath);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
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

  await assertMacSips();

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
        `(jpg/png/gif/heic).\n` +
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
    `Uploading ${files.length} file(s) via sips → JPEG (max ${MAX_EDGE}px q${JPEG_QUALITY}) → ${bucket}/${folder}/` +
      (dryRun ? ' (dry-run)' : ''),
  );

  let ok = 0;
  let failed = 0;

  for (const file of files) {
    let buffer;
    try {
      buffer = await toCatalogJpeg(file);
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
