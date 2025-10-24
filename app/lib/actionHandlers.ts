import type { ActionFunctionArgs } from 'react-router';
import { consumeToken } from '~/lib/rateLimiter';
import { logger } from '~/lib/logger';

// Extend globalThis for instrumentation
declare global {
  var __answersActionLastLog: number | undefined;
}

/**
 * 概要: 回答関連アクション（お気に入り、投票、コメント）を処理するハンドラー。
 * Contract:
 *   - Input: ActionFunctionArgs (request)
 *   - Output: Response (JSON)
 * Environment: サーバーサイドのみ。db.ts 関数を呼び出す。
 * Errors: レートリミット超過時は 429、DBエラー時は 500、無効リクエスト時は 400。
 */
export async function handleAnswerActions({ request }: ActionFunctionArgs) {
  const form = await request.formData();

  // Throttled lightweight instrumentation
  try {
    const anyKey = Array.from(form.keys())[0];
    const now = Date.now();
    globalThis.__answersActionLastLog = globalThis.__answersActionLastLog || 0;
    if (now - globalThis.__answersActionLastLog > 2000) {
      globalThis.__answersActionLastLog = now;
      logger.debug(
        'answers.action inbound keys',
        anyKey ? [...form.keys()] : []
      );
    }
  } catch {
    // Ignore instrumentation errors
  }

  const op = form.get('op') ? String(form.get('op')) : undefined;
  const answerIdRaw = form.get('answerId');
  const commentTextRaw = form.get('text');
  const levelRaw = form.get('level');
  const hasMeaningfulIntent =
    op === 'toggle' ||
    op === 'status' ||
    levelRaw != null ||
    (answerIdRaw && commentTextRaw);

  if (!hasMeaningfulIntent) {
    return Response.json({ ok: true, ignored: true });
  }

  // Rate limiting
  let rateKey = 'anon';
  try {
    const profileIdCandidate = form.get('profileId')
      ? String(form.get('profileId'))
      : form.get('userId')
        ? String(form.get('userId'))
        : undefined;
    if (profileIdCandidate) rateKey = `p:${profileIdCandidate}`;
    else {
      try {
        const hdr =
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip');
        if (hdr) rateKey = `ip:${String(hdr).split(',')[0].trim()}`;
      } catch {
        // Ignore header parsing errors
      }
    }
  } catch {
    // Ignore rate key setup errors
  }
  if (!consumeToken(rateKey, 1)) {
    throw new Response(
      JSON.stringify({ ok: false, error: 'Too Many Requests', rateKey }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Handle toggle (favorite)
  if (op === 'toggle') {
    return await handleToggleFavorite(form);
  }

  // Handle status (favorite check)
  if (op === 'status') {
    return await handleFavoriteStatus(form);
  }

  // Handle vote
  if (levelRaw != null) {
    return await handleVote(form);
  }

  // Handle comment
  return await handleAddComment(form);
}

async function handleToggleFavorite(form: FormData) {
  const answerId = form.get('answerId');
  const profileId = form.get('profileId')
    ? String(form.get('profileId'))
    : undefined;

  // Duplicate suppression
  try {
    const key = `toggle:${String(profileId)}:${String(answerId)}`;
    const now = Date.now();
    const prev = _recentPostGuard.get(key) ?? 0;
    if (now - prev < 800) {
      return Response.json({ ok: true, deduped: true });
    }
    _recentPostGuard.set(key, now);
  } catch {
    // Ignore duplicate suppression errors
  }

  if (!answerId || !profileId) {
    return new Response('Invalid', { status: 400 });
  }

  const { toggleFavorite } = await import('~/lib/db');
  const res = await toggleFavorite({
    answerId: Number(answerId),
    profileId,
  });
  return Response.json(res);
}

async function handleFavoriteStatus(form: FormData) {
  const answerId = form.get('answerId');
  const profileId = form.get('profileId')
    ? String(form.get('profileId'))
    : undefined;

  // Duplicate suppression
  try {
    const key = `status:${String(profileId)}:${String(answerId)}`;
    const now = Date.now();
    const prev = _recentPostGuard.get(key) ?? 0;
    if (now - prev < 800) {
      return Response.json({ favorited: false, deduped: true });
    }
    _recentPostGuard.set(key, now);
  } catch {
    // Ignore duplicate suppression errors
  }

  if (!answerId || !profileId) {
    throw new Response('Invalid', { status: 400 });
  }

  const { getFavoritesForProfile } = await import('~/lib/db');
  const list = await getFavoritesForProfile(profileId, [Number(answerId)]);
  const favorited = (list || []).map(Number).includes(Number(answerId));
  return Response.json({ favorited });
}

async function handleVote(form: FormData) {
  const answerId = Number(form.get('answerId'));
  const userId = form.get('userId') ? String(form.get('userId')) : undefined;
  const levelParsed = Number(form.get('level'));
  const level = levelParsed === 0 ? 0 : (levelParsed as 1 | 2 | 3);

  if (!answerId || !userId || level == null) {
    return new Response('Invalid vote', { status: 400 });
  }

  const { voteAnswer } = await import('~/lib/db');
  const updated = await voteAnswer({
    answerId,
    level,
    userId,
  });
  return Response.json({ answer: updated });
}

async function handleAddComment(form: FormData) {
  const answerId = form.get('answerId');
  const text = String(form.get('text') || '');
  const profileId = form.get('profileId')
    ? String(form.get('profileId'))
    : undefined;

  if (!answerId || !text) {
    return new Response('Invalid', { status: 400 });
  }
  if (!profileId) {
    return new Response('Missing profileId', { status: 400 });
  }

  const { addComment } = await import('~/lib/db');
  const comment = await addComment({
    answerId: String(answerId),
    text,
    profileId,
  });
  return Response.json({ comment });
}

// In-memory guard for duplicate requests (shared across routes)
const _recentPostGuard = new Map<string, number>();