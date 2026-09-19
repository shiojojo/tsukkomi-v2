import { createHash } from 'node:crypto';
import { supabase, supabaseAdmin, ensureConnection } from './supabase';

const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET ??
  (import.meta.env.STORAGE_BUCKET as string | undefined) ??
  'images';

const STORAGE_FOLDER =
  process.env.STORAGE_FOLDER ??
  (import.meta.env.STORAGE_FOLDER as string | undefined) ??
  'line-sync';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export type StoredImage = {
  path: string;
  publicUrl: string;
  reusedExisting: boolean;
};

function resolveStorageBucket() {
  if (!STORAGE_BUCKET) {
    throw new Error('Supabase storage bucket is not configured (STORAGE_BUCKET)');
  }
  return STORAGE_BUCKET;
}

function resolveStorageFolder() {
  return STORAGE_FOLDER.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
}

function resolveSupabaseUrl(): string | undefined {
  const fromVite = typeof import.meta !== 'undefined'
    ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
    : undefined;
  return (process.env.VITE_SUPABASE_URL || fromVite || '').replace(/\/$/, '') || undefined;
}

export function extFromContentType(contentType: string | null | undefined): string | null {
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

export function extFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return extFromPathname(parsed.pathname);
  } catch {
    return extFromPathname(url);
  }
}

function extFromPathname(pathname: string): string | null {
  const clean = pathname.split(/[?#]/)[0] ?? pathname;
  const idx = clean.lastIndexOf('.');
  if (idx >= 0 && idx < clean.length - 1) {
    const extCandidate = clean.slice(idx + 1).toLowerCase();
    if (/^[a-z0-9]{2,5}$/.test(extCandidate)) {
      return extCandidate;
    }
  }
  return null;
}

export function deriveImageExtension(
  sourceHint: string | null | undefined,
  contentType: string | null | undefined,
): string {
  const fromType = extFromContentType(contentType);
  if (fromType) return fromType === 'jpeg' ? 'jpg' : fromType;
  if (sourceHint) {
    const fromUrl = extFromUrl(sourceHint);
    if (fromUrl) return fromUrl === 'jpeg' ? 'jpg' : fromUrl;
  }
  return 'jpg';
}

export function contentTypeForExtension(extension: string): string {
  switch (extension.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function buildStoragePath(hashSeed: string, extension: string) {
  const hash = createHash('sha256').update(hashSeed).digest('hex').slice(0, 32);
  const folder = resolveStorageFolder();
  const sanitizedExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  return `${folder}/${hash}.${sanitizedExt}`;
}

/**
 * Returns true when the URL already points at this project's public Storage object.
 */
export function isOwnStoragePublicUrl(url: string): boolean {
  const supabaseUrl = resolveSupabaseUrl();
  if (!supabaseUrl) return false;
  try {
    const parsed = new URL(url);
    const expectedHost = new URL(supabaseUrl).host;
    if (parsed.host !== expectedHost) return false;
    const bucket = resolveStorageBucket();
    const prefix = `/storage/v1/object/public/${bucket}/`;
    return parsed.pathname.startsWith(prefix);
  } catch {
    return false;
  }
}

function getStorageWriteClient() {
  const storageClient = supabaseAdmin?.storage ?? supabase.storage;
  if (!storageClient) {
    throw new Error('No Supabase storage client configured for writes');
  }
  return storageClient;
}

/**
 * Upload an image buffer to Supabase Storage (with optional resize via imageProcessor).
 * Dedupes by content hash path; upserts so re-uploads of the same bytes are safe.
 */
export async function uploadImageBufferToSupabaseStorage(
  buffer: Buffer,
  options?: {
    contentType?: string | null;
    filenameHint?: string | null;
    hashSeed?: string;
  },
): Promise<StoredImage> {
  await ensureConnection();

  const extension = deriveImageExtension(
    options?.filenameHint ?? null,
    options?.contentType ?? null,
  );
  if (!ALLOWED_EXTENSIONS.has(extension) && extension !== 'jpeg') {
    throw new Error(`Unsupported image type: ${extension}`);
  }

  let processedBuffer: Buffer = buffer;
  let storedExt = extension === 'jpeg' ? 'jpg' : extension;
  try {
    const { processImageBuffer } = await import('./imageProcessor');
    processedBuffer = await processImageBuffer(buffer, extension);
    storedExt = 'jpg';
  } catch (error) {
    console.warn('Image processing failed, using original:', error);
  }

  const hashSeed =
    options?.hashSeed ??
    createHash('sha256').update(processedBuffer).digest('hex');
  const storagePath = buildStoragePath(hashSeed, storedExt);
  const bucket = resolveStorageBucket();
  const storageClient = getStorageWriteClient();

  const { error } = await storageClient.from(bucket).upload(storagePath, processedBuffer, {
    contentType: contentTypeForExtension(storedExt),
    upsert: true,
  });
  if (error) throw error;

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return {
    path: storagePath,
    publicUrl: publicUrlData.publicUrl,
    reusedExisting: false,
  };
}

/**
 * Resolve a public image URL into Storage.
 * If the URL is already our public Storage URL, skip fetch/upload and reuse it.
 */
export async function uploadImageFromUrlToSupabaseStorage(
  sourceUrl: string,
): Promise<StoredImage> {
  if (isOwnStoragePublicUrl(sourceUrl)) {
    const path = extractStoragePathFromPublicUrl(sourceUrl);
    return {
      path: path ?? '',
      publicUrl: sourceUrl,
      reusedExisting: true,
    };
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${sourceUrl}: ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return uploadImageBufferToSupabaseStorage(buffer, {
    contentType,
    filenameHint: sourceUrl,
    // Keep ingest paths stable across re-runs for the same source URL.
    hashSeed: sourceUrl,
  });
}

export function extractStoragePathFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const bucket = resolveStorageBucket();
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

export function assertAllowedImageContentType(contentType: string | null | undefined) {
  const ext = extFromContentType(contentType);
  if (!ext) {
    throw new Error(
      `Unsupported Content-Type: ${contentType ?? '(missing)'}. Allowed: image/jpeg, image/png, image/webp, image/gif`,
    );
  }
  return ext === 'jpeg' ? 'jpg' : ext;
}
