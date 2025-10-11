import sharp from 'sharp';

const THUMBNAIL_MAX_DIMENSION = 800;
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 80;

export async function processImageBuffer(buffer: Buffer, extension: string): Promise<Buffer> {
  let processedBuffer: Buffer = buffer;
  
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width && metadata.width > THUMBNAIL_MAX_DIMENSION) {
      processedBuffer = await sharp(buffer)
        .resize(THUMBNAIL_MAX_DIMENSION, null, { withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    } else if (extension === 'webp') {
      processedBuffer = await sharp(buffer)
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    }
  } catch (error) {
    console.warn('Image processing failed, using original:', error);
  }
  
  return processedBuffer;
}