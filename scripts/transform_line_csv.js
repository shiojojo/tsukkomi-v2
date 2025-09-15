#!/usr/bin/env node
// transform_line_csv.js
// Usage: node scripts/transform_line_csv.js input.csv output.sql
// Parses a CSV (handles quoted multiline fields) and produces SQL INSERTs for
// topics, profiles and answers suitable for importing into the project's DB.

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function parseCSV(text) {
  const rows = [];
  let cur = '';
  let row = [];
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        // peek next
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        cur += ch;
        i++;
        continue;
      }
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ',') {
      row.push(cur);
      cur = '';
      i++;
      continue;
    }

    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      i++;
      continue;
    }

    cur += ch;
    i++;
  }
  // last
  if (inQuotes) {
    // unterminated quote, still push
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function sqlEscape(s) {
  if (s == null) return 'NULL';
  const str = String(s);
  return "'" + str.replace(/'/g, "''") + "'";
}

function normalizeDate(d) {
  if (!d) return null;
  // try to parse YYYY/MM/DD or YYYY-MM-DD or ISO
  const m = d.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  if (m) {
    const y = m[1];
    const mo = String(m[2]).padStart(2, '0');
    const da = String(m[3]).padStart(2, '0');
    return `${y}-${mo}-${da}T00:00:00Z`;
  }
  // fallback: return null
  return null;
}

function generateUUID() {
  try {
    return randomUUID();
  } catch (e) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}

// load local env (if present)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT;
const STORAGE_ID = process.env.STORAGE_ID;
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET;
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;

let s3client = null;
if (STORAGE_ENDPOINT && STORAGE_ID && STORAGE_ACCESS_KEY && STORAGE_BUCKET) {
  s3client = new S3Client({
    endpoint: STORAGE_ENDPOINT,
    region: 'us-east-1',
    credentials: {
      accessKeyId: STORAGE_ID,
      secretAccessKey: STORAGE_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

async function downloadResizeAndUploadImage(srcUrl) {
  if (!s3client) return srcUrl;
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const array = await res.arrayBuffer();
    const input = Buffer.from(array);
    const outBuf = await sharp(input)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const key = `images/${generateUUID()}.jpg`;
    const cmd = new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: key,
      Body: outBuf,
      ContentType: 'image/jpeg',
    });
    await s3client.send(cmd);
    if (VITE_SUPABASE_URL)
      return `${VITE_SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${key}`;
    return `${STORAGE_ENDPOINT.replace(/\/$/, '')}/${STORAGE_BUCKET}/${key}`;
  } catch (err) {
    console.warn(
      'image upload failed for',
      srcUrl,
      err && err.message ? err.message : err
    );
    return srcUrl;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      'Usage: node scripts/transform_line_csv.js input.csv output.sql'
    );
    process.exit(2);
  }
  const input = path.resolve(args[0]);
  const output = path.resolve(args[1]);
  if (!fs.existsSync(input)) {
    console.error('input file not found:', input);
    process.exit(2);
  }

  const raw = fs.readFileSync(input, 'utf8');
  const rows = parseCSV(raw);
  if (!rows || rows.length === 0) {
    console.error('no rows');
    process.exit(1);
  }

  // header may exist. Detect header by checking first row contains non-data columns like '回答'
  let header = rows[0].map(c => (c || '').trim());
  let startIdx = 0;
  const headerCandidates = [
    'お題',
    '回答',
    '回答者ID',
    '回答者',
    '現在のお題',
    '現在の題',
  ];
  const isHeader = headerCandidates.some(hc => header.includes(hc));
  if (isHeader) startIdx = 1;

  const topics = new Map(); // key -> { id, title, image }
  const users = new Map(); // external id -> { uuid, name }
  const answers = [];

  let lastTopic = null;
  for (let r = startIdx; r < rows.length; r++) {
    const cols = rows[r].map(c => (c == null ? '' : c.trim()));
    // Ensure at least 3 columns
    const topicCell = cols[0] || '';
    const answerText = cols[1] || '';
    const answererId = cols[2] || '';
    const answererName = cols[3] || '';
    const maybeDate = cols[4] || cols[5] || '';

    const topic = topicCell !== '' ? topicCell : lastTopic;
    if (!topic) continue; // skip rows until we have a topic
    lastTopic = topic;

    // register topic id and detect photo topics (URLs)
    const isUrl = /^https?:\/\//i.test(topic);
    if (!topics.has(topic)) {
      const entry = {
        id: topics.size + 1,
        title: isUrl ? '写真' : topic,
        image: isUrl ? topic : null,
      };
      topics.set(topic, entry);
    }
    const topicId = topics.get(topic).id;

    let userUuid = null;
    if (answererId) {
      if (!users.has(answererId)) {
        const u = { uuid: generateUUID(), name: answererName || answererId };
        users.set(answererId, u);
      }
      userUuid = users.get(answererId).uuid;
    }

    const createdAt = normalizeDate(maybeDate);

    answers.push({
      topicId,
      text: answerText,
      authorName: answererName || null,
      authorUuid: userUuid,
      createdAt,
    });
  }

  // Build SQL
  const lines = [];
  lines.push('-- Generated by scripts/transform_line_csv.js');
  lines.push('BEGIN;');
  lines.push('');
  // topics inserts (explicit ids). Include image when available.
  // If configured, download remote images, resize and upload them, then replace the URL.
  for (const [key, entry] of topics.entries()) {
    if (entry.image && /^https?:\/\//i.test(entry.image)) {
      try {
        // sequential to avoid parallel downloads
        // eslint-disable-next-line no-await-in-loop
        entry.image = await downloadResizeAndUploadImage(entry.image);
      } catch (e) {
        console.warn(
          'failed to process image',
          entry.image,
          e && e.message ? e.message : e
        );
      }
    }
  }
  for (const [key, entry] of topics.entries()) {
    const id = entry.id;
    const title = entry.title;
    if (entry.image) {
      lines.push(
        `INSERT INTO topics (id, title, image) VALUES (${id}, ${sqlEscape(title)}, ${sqlEscape(entry.image)});`
      );
    } else {
      lines.push(
        `INSERT INTO topics (id, title) VALUES (${id}, ${sqlEscape(title)});`
      );
    }
  }
  lines.push('');
  // profiles inserts (include external line_id)
  for (const [ext, u] of users.entries()) {
    // ext is the external responder id from the CSV (e.g. LINE user id)
    lines.push(
      `INSERT INTO profiles (id, name, line_id) VALUES (${sqlEscape(u.uuid)}, ${sqlEscape(u.name)}, ${sqlEscape(ext)});`
    );
  }
  lines.push('');
  // answers
  for (const a of answers) {
    const vals = [];
    vals.push('DEFAULT'); // id
    vals.push(sqlEscape(a.text || ''));
    vals.push(a.authorName ? sqlEscape(a.authorName) : 'NULL');
    vals.push(a.authorUuid ? sqlEscape(a.authorUuid) : 'NULL');
    vals.push(a.topicId ? String(a.topicId) : 'NULL');
    vals.push(a.createdAt ? sqlEscape(a.createdAt) : 'now()');
    lines.push(
      `INSERT INTO answers (id, text, author_name, author_id, topic_id, created_at) VALUES (${vals.join(', ')});`
    );
  }

  lines.push('');
  lines.push('COMMIT;');

  fs.writeFileSync(output, lines.join('\n'), 'utf8');
  console.log(
    'Wrote',
    output,
    'topics:',
    topics.size,
    'profiles:',
    users.size,
    'answers:',
    answers.length
  );
}

if (
  typeof process !== 'undefined' &&
  process.argv[1].endsWith(path.basename(import.meta.url))
) {
  main();
}
