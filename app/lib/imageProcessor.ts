import sharp from 'sharp';

/** Catalog / upload normalize: always JPEG. */
const MAX_EDGE = 800;
const JPEG_QUALITY = 75;

/**
 * Normalize image bytes for Storage: max edge 800, JPEG q75, strip metadata.
 * Orientation from EXIF is applied via rotate() before strip.
 * Throws if sharp cannot process the buffer (caller may fall back to original).
 */
export async function processImageBuffer(buffer: Buffer, _extension?: string): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}
