import { supabase, supabaseAdmin, ensureConnection } from '../supabase';

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET ??
  (import.meta.env.STORAGE_BUCKET as string | undefined) ??
  'images';

const STORAGE_FOLDER =
  process.env.STORAGE_FOLDER ??
  (import.meta.env.STORAGE_FOLDER as string | undefined) ??
  'line-sync';

function writeClient() {
  const client = supabaseAdmin ?? supabase;
  if (!client) throw new Error('No Supabase client configured');
  return client;
}

function resolveFolder() {
  return STORAGE_FOLDER.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
}

/**
 * Public URLs (image + source_image) for topics that already have ≥1 answer.
 */
export async function listAnsweredImageUrlSet(): Promise<Set<string>> {
  await ensureConnection();
  const client = writeClient();

  const { data, error } = await client
    .from('answers')
    .select('topic_id, topics!inner(id, image, source_image)')
    .not('topic_id', 'is', null);

  if (error) throw error;

  const urls = new Set<string>();
  for (const row of data ?? []) {
    const topic = row.topics as
      | { image?: string | null; source_image?: string | null }
      | { image?: string | null; source_image?: string | null }[]
      | null;
    const topicRow = Array.isArray(topic) ? topic[0] : topic;
    if (!topicRow) continue;
    for (const candidate of [topicRow.image, topicRow.source_image]) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (/^https?:\/\//i.test(trimmed)) urls.add(trimmed);
      }
    }
  }
  return urls;
}

async function listStorageObjectPaths(): Promise<string[]> {
  await ensureConnection();
  const client = writeClient();
  const bucket = STORAGE_BUCKET || 'images';
  const folder = resolveFolder();
  const paths: string[] = [];
  const pageSize = 100;
  let offset = 0;

  for (;;) {
    const { data, error } = await client.storage.from(bucket).list(folder, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    const batch = data ?? [];
    for (const item of batch) {
      // Skip folder placeholders
      if (!item.name || item.id == null) continue;
      paths.push(`${folder}/${item.name}`);
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
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
  answeredUrlCount: number;
  unusedCount: number;
};

/**
 * Candidates = objects in STORAGE_FOLDER.
 * Unused = public URL not present on any answered topic (image or source_image).
 * Diff is computed server-side; callers only receive unused URLs.
 */
export async function listUnusedImageUrls(): Promise<UnusedImageUrlsResult> {
  const [answered, paths] = await Promise.all([
    listAnsweredImageUrlSet(),
    listStorageObjectPaths(),
  ]);

  const unused: string[] = [];
  for (const path of paths) {
    const url = publicUrlForPath(path);
    if (!answered.has(url)) unused.push(url);
  }

  return {
    urls: unused,
    storageCount: paths.length,
    answeredUrlCount: answered.size,
    unusedCount: unused.length,
  };
}
