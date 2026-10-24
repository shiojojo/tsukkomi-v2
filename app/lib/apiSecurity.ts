import { timingSafeEqual } from 'node:crypto';

export const MAX_LINE_INGEST_BODY_BYTES = 1024 * 1024;

export function matchesApiKey(expected: string, provided: string | null): boolean {
  if (!provided) return false;

  const expectedBytes = Buffer.from(expected, 'utf8');
  const providedBytes = Buffer.from(provided, 'utf8');
  return expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes);
}

export type JsonBodyReadResult =
  | { kind: 'ok'; value: unknown }
  | { kind: 'invalid' }
  | { kind: 'too-large' };

export async function readJsonBody(
  request: Request,
  maxBytes = MAX_LINE_INGEST_BODY_BYTES,
): Promise<JsonBodyReadResult> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { kind: 'too-large' };
  }

  if (!request.body) return { kind: 'invalid' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { kind: 'too-large' };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { kind: 'ok', value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { kind: 'invalid' };
  }
}