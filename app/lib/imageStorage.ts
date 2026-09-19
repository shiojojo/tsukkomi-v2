const STORAGE_BUCKET =
  process.env.STORAGE_BUCKET ??
  (import.meta.env.STORAGE_BUCKET as string | undefined) ??
  'images';

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

function resolveSupabaseUrl(): string | undefined {
  const fromVite =
    typeof import.meta !== 'undefined'
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

/**
 * Resolve an image odai URL for ingest.
 * Catalog images must already be this project's Storage public URLs
 * (upload via `pnpm upload:images`). External URLs are not re-uploaded.
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

  throw new Error(
    `Image topic sourceImage must be this project's Storage public URL ` +
      `(got non-Storage URL). Upload with pnpm upload:images first: ${sourceUrl}`,
  );
}
