import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { LineAnswerIngestRequestSchema } from '~/lib/schemas/line-sync';
import { ingestLineAnswers } from '~/lib/db';

const API_KEY_HEADER = 'x-api-key';

function resolveLineSyncApiKey(): string | undefined {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  return (
    process.env.LINE_SYNC_API_KEY ||
    process.env.VITE_LINE_SYNC_API_KEY ||
    (metaEnv ? metaEnv.LINE_SYNC_API_KEY : undefined) ||
    (metaEnv ? metaEnv.VITE_LINE_SYNC_API_KEY : undefined)
  );
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

  const configuredKey = resolveLineSyncApiKey();
  if (!configuredKey) {
    return jsonResponse({ error: 'Server missing LINE_SYNC_API_KEY' }, { status: 500 });
  }

  const providedKey = request.headers.get(API_KEY_HEADER);
  if (!providedKey || providedKey !== configuredKey) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    return jsonResponse({ error: 'Invalid JSON payload', detail: (error as Error)?.message ?? String(error) }, { status: 400 });
  }

  const parsed = LineAnswerIngestRequestSchema.safeParse(rawBody);
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
    const result = await ingestLineAnswers(parsed.data);
    return jsonResponse({ ok: true, result });
  } catch (error) {
    console.error('LINE ingest failed', error);
    return jsonResponse({ ok: false, error: (error as Error)?.message ?? 'Unknown error' }, { status: 500 });
  }
}
