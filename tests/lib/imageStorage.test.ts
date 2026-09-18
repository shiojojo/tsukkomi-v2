import { describe, expect, it } from 'vitest';
import {
  deriveImageExtension,
  extFromContentType,
  extractStoragePathFromPublicUrl,
  isOwnStoragePublicUrl,
} from '~/lib/imageStorage';

describe('imageStorage helpers', () => {
  it('derives extension from content-type', () => {
    expect(extFromContentType('image/jpeg')).toBe('jpg');
    expect(extFromContentType('image/png; charset=binary')).toBe('png');
    expect(extFromContentType('text/plain')).toBeNull();
  });

  it('falls back to filename / url extension', () => {
    expect(deriveImageExtension('photo.WEBP', null)).toBe('webp');
    expect(deriveImageExtension('https://cdn.example/a/b/c.png?x=1', null)).toBe('png');
    expect(deriveImageExtension(null, 'image/gif')).toBe('gif');
  });

  it('detects own storage public URLs when VITE_SUPABASE_URL is set', () => {
    const prev = process.env.VITE_SUPABASE_URL;
    process.env.VITE_SUPABASE_URL = 'https://abcd.supabase.co';
    try {
      expect(
        isOwnStoragePublicUrl(
          'https://abcd.supabase.co/storage/v1/object/public/images/line-sync/abc.jpg',
        ),
      ).toBe(true);
      expect(
        isOwnStoragePublicUrl(
          'https://abcd.supabase.co/storage/v1/object/public/other/x.jpg',
        ),
      ).toBe(false);
      expect(
        isOwnStoragePublicUrl('https://drive.usercontent.google.com/download?id=1'),
      ).toBe(false);
      expect(
        extractStoragePathFromPublicUrl(
          'https://abcd.supabase.co/storage/v1/object/public/images/line-sync/abc.jpg',
        ),
      ).toBe('line-sync/abc.jpg');
    } finally {
      if (prev === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prev;
    }
  });
});
