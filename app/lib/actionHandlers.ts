import type { ActionFunctionArgs } from 'react-router';
import { consumeRequestToken } from '~/lib/rateLimiter';
import {
  CommentActionSchema,
  FavoriteActionSchema,
  VoteActionSchema,
} from '~/lib/schemas/answerAction';

/**
 * 概要: 回答関連アクション（お気に入り、投票、コメント）を処理するハンドラー。
 * Contract:
 *   - Input: ActionFunctionArgs (request)
 *   - Output: Response (JSON)
 * Environment: サーバーサイドのみ。db.ts 関数を呼び出す。
 * Errors: レートリミット超過時は 429、DBエラー時は 500、無効リクエスト時は 400。
 */
export async function handleAnswerActions({ request }: ActionFunctionArgs) {
  if (!consumeRequestToken(request, 1, 'answer-action')) {
    throw new Response(
      JSON.stringify({ ok: false, error: 'Too Many Requests' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const form = await request.formData();

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
  const parsed = FavoriteActionSchema.safeParse({
    answerId: form.get('answerId'),
    profileId: form.get('profileId'),
  });
  if (!parsed.success) return Response.json({ error: 'Invalid favorite request' }, { status: 400 });

  const { toggleFavorite } = await import('~/lib/db');
  const res = await toggleFavorite(parsed.data);
  return Response.json(res);
}

async function handleFavoriteStatus(form: FormData) {
  const parsed = FavoriteActionSchema.safeParse({
    answerId: form.get('answerId'),
    profileId: form.get('profileId'),
  });
  if (!parsed.success) return Response.json({ error: 'Invalid favorite request' }, { status: 400 });

  const { getFavoritesForProfile } = await import('~/lib/db');
  const list = await getFavoritesForProfile(parsed.data.profileId, [parsed.data.answerId]);
  const favorited = (list || []).map(Number).includes(parsed.data.answerId);
  return Response.json({ favorited });
}

async function handleVote(form: FormData) {
  const parsed = VoteActionSchema.safeParse({
    answerId: form.get('answerId'),
    userId: form.get('userId'),
    level: form.get('level'),
  });
  if (!parsed.success) return Response.json({ error: 'Invalid vote request' }, { status: 400 });

  const { voteAnswer } = await import('~/lib/db');
  const updated = await voteAnswer(parsed.data);
  return Response.json({ answer: updated });
}

async function handleAddComment(form: FormData) {
  const parsed = CommentActionSchema.safeParse({
    answerId: form.get('answerId'),
    text: form.get('text'),
    profileId: form.get('profileId'),
  });
  if (!parsed.success) return Response.json({ error: 'Invalid comment request' }, { status: 400 });

  const { addComment } = await import('~/lib/db');
  const comment = await addComment(parsed.data);
  return Response.json({ comment });
}
