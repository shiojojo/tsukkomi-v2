import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

const API_KEY_HEADER = 'x-api-key';

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

function authorize(request: Request): Response | null {
  const configuredKey = resolveLineSyncApiKey();
  if (!configuredKey) {
    return jsonResponse({ error: 'Server missing LINE_SYNC_API_KEY' }, { status: 500 });
  }
  const providedKey = request.headers.get(API_KEY_HEADER);
  if (!providedKey || providedKey !== configuredKey) {
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
