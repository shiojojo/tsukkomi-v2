import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { matchesApiKey } from '~/lib/apiSecurity';
import { consumeRequestToken } from '~/lib/rateLimiter';

const API_KEY_HEADER = 'x-api-key';

function resolveLineSyncApiKey(): string | undefined {
  return process.env.LINE_SYNC_API_KEY;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function authorize(request: Request): Response | null {
  const configuredKey = resolveLineSyncApiKey();
  if (!configuredKey) {
    return jsonResponse({ error: 'Server missing LINE_SYNC_API_KEY' }, { status: 500 });
  }
  const providedKey = request.headers.get(API_KEY_HEADER);
  if (!matchesApiKey(configuredKey, providedKey)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * GET /api/unused-image-urls
 * Returns only unanswered photo-odai public URLs (Storage folder − answered topics).
 * For monthly spreadsheet rebuild — GAS should not fetch all answered URLs.
 * Auth: X-API-Key (LINE_SYNC_API_KEY)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method.toUpperCase() !== 'GET') {
    return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });
  }

  if (!consumeRequestToken(request, 1, 'unused-image-urls')) {
    return jsonResponse({ error: 'Too Many Requests' }, { status: 429 });
  }

  const denied = authorize(request);
  if (denied) return denied;

  try {
    const { listUnusedImageUrls } = await import('~/lib/db/unusedImageUrls');
    const result = await listUnusedImageUrls();
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    console.error('unused-image-urls failed', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function action(_args: ActionFunctionArgs) {
  return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });
}
