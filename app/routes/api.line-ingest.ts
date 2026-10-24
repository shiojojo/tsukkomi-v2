import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { matchesApiKey, readJsonBody } from '~/lib/apiSecurity';
import { consumeRequestToken } from '~/lib/rateLimiter';
import { LineAnswerIngestRequestSchema } from '~/lib/schemas/line-sync';
// server-only imports are done inside loader/action to avoid bundling Supabase client in browser code

const API_KEY_HEADER = 'x-api-key';

function resolveLineSyncApiKey(): string | undefined {
  return process.env.LINE_SYNC_API_KEY;
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
 * 概要: LINE (GAS) 側からの回答バッチを受け取り、DB 取り込み関数へ委譲する。
 * Contract: POST /api/line-ingest with JSON body matching LineAnswerIngestRequestSchema。
 * Auth: X-API-Key ヘッダで共有シークレットを送信する。
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });
  }

  if (!consumeRequestToken(request, 1, 'line-ingest')) {
    return jsonResponse({ error: 'Too Many Requests' }, { status: 429 });
  }

  const configuredKey = resolveLineSyncApiKey();
  if (!configuredKey) {
    return jsonResponse({ error: 'Server missing LINE_SYNC_API_KEY' }, { status: 500 });
  }

  const providedKey = request.headers.get(API_KEY_HEADER);
  if (!matchesApiKey(configuredKey, providedKey)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (body.kind === 'too-large') {
    return jsonResponse({ error: 'Payload too large' }, { status: 413 });
  }
  if (body.kind === 'invalid') {
    return jsonResponse({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = LineAnswerIngestRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return jsonResponse({
      error: 'Validation failed',
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }, { status: 400 });
  }

  try {
    const { ingestLineAnswers } = await import('~/lib/db/lineSync');
    const result = await ingestLineAnswers(parsed.data);
    return jsonResponse({ ok: true, result });
  } catch (error) {
    console.error('LINE ingest failed', error);
    return jsonResponse({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
