import { supabase, supabaseAdmin, ensureConnection } from '../supabase';

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET ??
  (import.meta.env.STORAGE_BUCKET as string | undefined) ??
  'images';

const STORAGE_FOLDER =
  process.env.STORAGE_FOLDER ??
  (import.meta.env.STORAGE_FOLDER as string | undefined) ??
  'line-sync';

/** Extra folders under the bucket (comma-separated). Default: none — catalog is STORAGE_FOLDER only. */
const EXTRA_STORAGE_FOLDERS = (process.env.STORAGE_EXTRA_FOLDERS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function writeClient() {
  const client = supabaseAdmin ?? supabase;
  if (!client) throw new Error('No Supabase client configured');
  return client;
}

function resolveFolder() {
  return STORAGE_FOLDER.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
}

function candidateFolders(): string[] {
  const primary = resolveFolder();
  const set = new Set<string>([primary, ...EXTRA_STORAGE_FOLDERS]);
  return [...set];
}

/** Filename stem used as content/key id, e.g. line-sync/abc.webp → abc */
export function storageObjectKey(urlOrPath: string): string | null {
  try {
    const raw = /^https?:\/\//i.test(urlOrPath)
      ? new URL(urlOrPath).pathname
      : urlOrPath;
    const base = raw.split('/').pop() || '';
    const stem = base.replace(/\.[a-z0-9]{2,5}$/i, '');
    return stem || null;
  } catch {
    return null;
  }
}

/**
 * Image topics already in DB = used (LINE image topics are created only when answers sync).
 * Keys are storage object stems (hash), not full URLs — folder/extension must not matter.
 */
export async function listUsedImageKeys(): Promise<{
  keys: Set<string>;
  urls: Set<string>;
  usedTopicCount: number;
}> {
  await ensureConnection();
  const client = writeClient();
  const keys = new Set<string>();
  const urls = new Set<string>();
  const topicIds = new Set<number>();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await client
      .from('topics')
      .select('id, image, source_image')
      .or('image.not.is.null,source_image.not.is.null')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const batch = data ?? [];
    for (const row of batch) {
      if (row.id != null) topicIds.add(Number(row.id));
      for (const candidate of [row.image, row.source_image]) {
        if (typeof candidate !== 'string') continue;
        const trimmed = candidate.trim();
        if (!/^https?:\/\//i.test(trimmed)) continue;
        urls.add(trimmed);
        const key = storageObjectKey(trimmed);
        if (key) keys.add(key);
      }
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { keys, urls, usedTopicCount: topicIds.size };
}

async function listFilesInFolder(folder: string): Promise<string[]> {
  const client = writeClient();
  const bucket = STORAGE_BUCKET || 'images';
  const paths: string[] = [];
  const pageSize = 100;
  let offset = 0;
  const prefix = folder.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');

  for (;;) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    const batch = data ?? [];
    for (const item of batch) {
      if (!item.name || item.id == null) continue;
      paths.push(prefix ? `${prefix}/${item.name}` : item.name);
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return paths;
}

async function listStorageObjectPaths(): Promise<string[]> {
  await ensureConnection();
  const paths: string[] = [];
  for (const folder of candidateFolders()) {
    paths.push(...(await listFilesInFolder(folder)));
  }
  return paths;
}

function publicUrlForPath(storagePath: string): string {
  const bucket = STORAGE_BUCKET || 'images';
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

function preferPath(a: string, b: string): string {
  const primary = resolveFolder();
  const aPrimary = a.startsWith(`${primary}/`);
  const bPrimary = b.startsWith(`${primary}/`);
  if (aPrimary !== bPrimary) return aPrimary ? a : b;
  return a.length <= b.length ? a : b;
}

export type UnusedImageUrlsResult = {
  urls: string[];
  storageCount: number;
  storageUniqueKeyCount: number;
  /** @deprecated use usedUrlCount */
  answeredUrlCount: number;
  usedUrlCount: number;
  usedKeyCount: number;
  usedTopicCount: number;
  unusedCount: number;
  folders: string[];
};

/**
 * Candidates = Storage objects, deduped by filename stem (hash).
 * Used = stems from topics.image / source_image.
 * Matching is by filename stem so path/extension differences do not matter.
 */
export async function listUnusedImageUrls(): Promise<UnusedImageUrlsResult> {
  const folders = candidateFolders();
  const [used, paths] = await Promise.all([
    listUsedImageKeys(),
    listStorageObjectPaths(),
  ]);

  // Dedupe storage objects by stem; prefer STORAGE_FOLDER (line-sync) over legacy.
  const bestPathByKey = new Map<string, string>();
  for (const path of paths) {
    const key = storageObjectKey(path);
    if (!key) continue;
    const prev = bestPathByKey.get(key);
    bestPathByKey.set(key, prev ? preferPath(prev, path) : path);
  }

  const unused: string[] = [];
  for (const [key, path] of bestPathByKey) {
    if (used.keys.has(key)) continue;
    unused.push(publicUrlForPath(path));
  }

  return {
    urls: unused,
    storageCount: paths.length,
    storageUniqueKeyCount: bestPathByKey.size,
    answeredUrlCount: used.urls.size,
    usedUrlCount: used.urls.size,
    usedKeyCount: used.keys.size,
    usedTopicCount: used.usedTopicCount,
    unusedCount: unused.length,
    folders,
  };
}
