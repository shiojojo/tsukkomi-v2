import { supabase, supabaseAdmin, ensureConnection } from '../supabase';

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET ??
  (import.meta.env.STORAGE_BUCKET as string | undefined) ??
  'images';

const STORAGE_FOLDER =
  process.env.STORAGE_FOLDER ??
  (import.meta.env.STORAGE_FOLDER as string | undefined) ??
  'line-sync';

/** Extra folders under the bucket to include (legacy import paths, etc.). */
const EXTRA_STORAGE_FOLDERS = (process.env.STORAGE_EXTRA_FOLDERS ?? 'images')
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

/**
 * Image topics already in DB = used (LINE image topics are created only when answers sync).
 * Query topics filtered by image/source_image — do not page through answers.
 */
export async function listUsedImageUrlSet(): Promise<{
  urls: Set<string>;
  usedTopicCount: number;
}> {
  await ensureConnection();
  const client = writeClient();
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
        if (typeof candidate === 'string') {
          const trimmed = candidate.trim();
          if (/^https?:\/\//i.test(trimmed)) urls.add(trimmed);
        }
      }
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { urls, usedTopicCount: topicIds.size };
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

export type UnusedImageUrlsResult = {
  urls: string[];
  storageCount: number;
  /** @deprecated use usedUrlCount — kept for older GAS logs */
  answeredUrlCount: number;
  usedUrlCount: number;
  usedTopicCount: number;
  unusedCount: number;
  folders: string[];
};

/**
 * Candidates = Storage folders (line-sync + legacy images by default).
 * Used = topics with image/source_image set (image odai already in DB).
 * Unused = storage public URL not in that set.
 */
export async function listUnusedImageUrls(): Promise<UnusedImageUrlsResult> {
  const folders = candidateFolders();
  const [used, paths] = await Promise.all([
    listUsedImageUrlSet(),
    listStorageObjectPaths(),
  ]);

  const unused: string[] = [];
  for (const path of paths) {
    const url = publicUrlForPath(path);
    if (!used.urls.has(url)) unused.push(url);
  }

  return {
    urls: unused,
    storageCount: paths.length,
    answeredUrlCount: used.urls.size,
    usedUrlCount: used.urls.size,
    usedTopicCount: used.usedTopicCount,
    unusedCount: unused.length,
    folders,
  };
}
