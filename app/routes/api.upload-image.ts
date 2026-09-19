import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  assertAllowedImageContentType,
  deriveImageExtension,
  uploadImageBufferToSupabaseStorage,
} from '~/lib/imageStorage';

const API_KEY_HEADER = 'x-api-key';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MiB

function resolveLineSyncApiKey(): string | undefined {
  const metaEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env: Record<string, string | undefined> }).env
      : undefined;
  return process.env.LINE_SYNC_API_KEY || (metaEnv ? metaEnv.LINE_SYNC_API_KEY : undefined);
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

/** GET is not supported for this endpoint */
export async function loader(_args: LoaderFunctionArgs) {
  return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });
}

/**
 * 概要: 画像バイナリを受け取り Supabase Storage に保存し、公開 URL を返す。
 * Contract:
 *   - POST /api/upload-image
 *   - multipart/form-data with field `file` (or `image`), OR raw body with image Content-Type
 * Auth: X-API-Key (LINE_SYNC_API_KEY)
 * SideEffects: Storage upload only (does not create topics rows).
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const configuredKey = resolveLineSyncApiKey();
  if (!configuredKey) {
    return jsonResponse({ error: 'Server missing LINE_SYNC_API_KEY' }, { status: 500 });
  }

  const providedKey = request.headers.get(API_KEY_HEADER);
  if (!providedKey || providedKey !== configuredKey) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { buffer, contentType, filenameHint } = await readImagePayload(request);
    if (buffer.byteLength === 0) {
      return jsonResponse({ error: 'Empty image body' }, { status: 400 });
    }
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return jsonResponse(
        { error: `Image too large (max ${MAX_UPLOAD_BYTES} bytes)` },
        { status: 413 },
      );
    }

    // Prefer Content-Type; fall back to filename extension when type is missing.
    if (contentType) {
      assertAllowedImageContentType(contentType);
    } else {
      const ext = deriveImageExtension(filenameHint, null);
      if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        return jsonResponse(
          {
            error:
              'Could not determine image type (set Content-Type or use a .jpg/.png/.webp/.gif filename)',
          },
          { status: 400 },
        );
      }
    }

    const stored = await uploadImageBufferToSupabaseStorage(buffer, {
      contentType,
      filenameHint,
    });

    return jsonResponse({
      ok: true,
      path: stored.path,
      publicUrl: stored.publicUrl,
    });
  } catch (error) {
    console.error('Image upload failed', error);
    const message = (error as Error)?.message ?? '';
    if (message.startsWith('Unsupported') || message.includes('multipart')) {
      return jsonResponse(
        {
          ok: false,
          error:
            'Unsupported body. Send multipart/form-data with `file`, or raw body with Content-Type image/*',
        },
        { status: 400 },
      );
    }
    if (message.includes('Missing')) {
      return jsonResponse(
        { ok: false, error: 'Missing multipart file field `file` (or `image`)' },
        { status: 400 },
      );
    }
    return jsonResponse({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

async function readImagePayload(request: Request): Promise<{
  buffer: Buffer;
  contentType: string | null;
  filenameHint: string | null;
}> {
  const contentTypeHeader = request.headers.get('content-type') ?? '';

  if (contentTypeHeader.toLowerCase().includes('multipart/form-data')) {
    const form = await request.formData();
    const entry = form.get('file') ?? form.get('image');
    if (!entry || typeof entry === 'string') {
      throw new Error('Missing multipart file field `file` (or `image`)');
    }
    const file = entry as File;
    const arrayBuffer = await file.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: file.type || null,
      filenameHint: file.name || null,
    };
  }

  if (contentTypeHeader.toLowerCase().startsWith('image/')) {
    const arrayBuffer = await request.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: contentTypeHeader,
      filenameHint: null,
    };
  }

  throw new Error(
    'Unsupported body. Send multipart/form-data with `file`, or raw body with Content-Type image/*',
  );
}
