import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import StickyHeaderLayout from '~/components/StickyHeaderLayout';
import AnswerActionCard from '~/components/AnswerActionCard';
import { useAnswerUserData } from '~/hooks/useAnswerUserData';
import { useIdentity } from '~/hooks/useIdentity';
import type { Comment } from '~/lib/schemas/comment';
import type { Topic } from '~/lib/schemas/topic';
import type { Answer } from '~/lib/schemas/answer';
import type { User } from '~/lib/schemas/user';
import { consumeToken } from '~/lib/rateLimiter';
import { logger } from '~/lib/logger';

const _recentPostGuard = new Map<string, number>();

/**
 * 概要: 指定されたお題に紐づく回答・コメント・ユーザー情報をまとめて取得する。
 * Intent: /topics/:id でも /answers と同じカード UI を利用できるよう、初期描画に必要なデータを一括で返却する。
 * Contract:
 *   - params.id は必須。存在しない場合 400。
 *   - 戻り値は { topic, answers, commentsByAnswer, users, profileId }。
 *     answers は created_at desc を維持し、副作用として favorited / favCount を付与する可能性がある。
 * Environment:
 *   - dev: モック DB。
 *   - prod: Supabase。
 * Errors: DB エラーや対象なし時は Response を throw し上位ハンドラに委譲。
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const topicId = params.id ? String(params.id) : '';
  if (!topicId) throw new Response('Invalid topic id', { status: 400 });

  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') ?? undefined;

  const { getTopic, getAnswersByTopic, getCommentsForAnswers, getUsers } =
    await import('~/lib/db');

  const topic = await getTopic(topicId);
  if (!topic) throw new Response('Not Found', { status: 404 });

  const answers = (await getAnswersByTopic(topicId, profileId)) as Answer[];
  const answerIds = answers.map(answer => Number(answer.id));

  const commentsByAnswer: Record<string, Comment[]> = answerIds.length
    ? await getCommentsForAnswers(answerIds)
    : {};

  const users = await getUsers({ limit: 200 });

  try {
    const { getFavoriteCounts, getFavoritesForProfile } = await import(
      '~/lib/db'
    );
    const favoriteCounts = await getFavoriteCounts(answerIds);
    for (const answer of answers) {
      (answer as any).favCount = favoriteCounts[Number(answer.id)] ?? 0;
    }
    if (profileId) {
      try {
        const favorites = await getFavoritesForProfile(profileId, answerIds);
        const favSet = new Set((favorites || []).map(value => Number(value)));
        for (const answer of answers) {
          (answer as any).favorited = favSet.has(Number(answer.id));
        }
      } catch {}
    }
  } catch {}

  return {
    topic,
    answers,
    commentsByAnswer,
    users,
    profileId: profileId ?? null,
  } as const;
}

/**
 * 概要: /topics/:id の回答に対するお気に入り・採点・コメント投稿を処理する。
 * Intent: AnswerActionCard から送信される FormData を /answers と同じプロトコルで処理し、UI の一貫性を保つ。
 * Contract:
 *   - Favorite toggle: { op:'toggle', answerId, profileId } → { favorited:boolean }
 *   - Vote: { answerId, level(0-3), previousLevel?, userId } → { answer }
 *   - Comment: { answerId, text, profileId } → { ok:true }
 * Environment:
 *   - dev/prod で lib/db が適切な実装を返す。
 * Errors: バリデーション失敗は 400、レート制限は 429、DB 失敗は 500。
 */
export async function action({ request }: ActionFunctionArgs) {
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
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 204,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
      } catch {}
    }
  } catch {}

  if (!consumeToken(rateKey, 1)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Too Many Requests', rateKey }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (op === 'toggle') {
    const answerId = form.get('answerId');
    const profileId = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    try {
      const key = `toggle:${String(profileId)}:${String(answerId)}`;
      const now = Date.now();
      const prev = _recentPostGuard.get(key) ?? 0;
      if (now - prev < 800) {
        return new Response(JSON.stringify({ ok: true, deduped: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      _recentPostGuard.set(key, now);
    } catch {}
    if (!answerId || !profileId)
      return new Response('Invalid', { status: 400 });
    const { toggleFavorite } = await import('~/lib/db');
    try {
      const res = await toggleFavorite({
        answerId: Number(answerId),
        profileId,
      });
      return new Response(JSON.stringify(res), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      logger.error('toggleFavorite failed', error);
      return new Response(
        JSON.stringify({ ok: false, error: String(error?.message ?? error) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  if (op === 'status') {
    const answerId = form.get('answerId');
    const profileId = form.get('profileId')
      ? String(form.get('profileId'))
      : undefined;
    if (!answerId || !profileId)
      return new Response('Invalid', { status: 400 });
    const { getFavoritesForProfile } = await import('~/lib/db');
    try {
      const list = await getFavoritesForProfile(profileId, [Number(answerId)]);
      const favorited = (list || []).map(Number).includes(Number(answerId));
      return new Response(JSON.stringify({ favorited }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ ok: false, error: String(error?.message ?? error) }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  if (levelRaw != null) {
    const answerId = Number(form.get('answerId'));
    const userId = form.get('userId') ? String(form.get('userId')) : undefined;
    const levelParsed = Number(levelRaw);
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
    return new Response(JSON.stringify({ answer: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
  try {
    await addComment({
      answerId: String(answerId),
      text,
      profileId,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    logger.error('topics.action addComment failed', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error?.message ?? error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * お題詳細ページ本体。回答カードを AnswerActionCard に統一し、/answers と同じ UI/UX を提供する。
 */
export default function TopicDetailRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const { topic, answers, commentsByAnswer, users, profileId } =
    useLoaderData() as LoaderData;

  const usersById = useMemo(
    () =>
      Object.fromEntries(users.map(user => [String(user.id), user])) as Record<
        string,
        User
      >,
    [users]
  );

  const getNameByProfileId = (pid?: string | null) => {
    if (!pid) return undefined;
    const found = usersById[String(pid)];
    return found ? found.name : undefined;
  };

  const { effectiveId: currentUserId, effectiveName: currentUserName } =
    useIdentity();

  const answerIds = useMemo(() => answers.map(answer => answer.id), [answers]);
  const { data: userAnswerData, markFavorite } = useAnswerUserData(answerIds);

  return (
    <StickyHeaderLayout
      header={
        <div className="z-30 bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
          <div className="p-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              お題詳細
            </h1>
            <Link
              to="/topics"
              className="text-sm text-blue-600 hover:underline"
            >
              お題一覧へ
            </Link>
          </div>
        </div>
      }
    >
      <TopicOverviewCard topic={topic} answerCount={answers.length} />
      {answers.length === 0 ? (
        <p className="px-4 text-sm text-gray-600 dark:text-gray-300">
          まだ回答が投稿されていません。
        </p>
      ) : (
        <ul className="px-4 pb-16 space-y-4">
          {answers.map(answer => (
            <AnswerActionCard
              key={answer.id}
              answer={answer}
              topic={topic}
              comments={commentsByAnswer[String(answer.id)] ?? []}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              getNameByProfileId={getNameByProfileId}
              userAnswerData={userAnswerData}
              onFavoriteUpdate={markFavorite}
              actionPath={`/topics/${topic.id}`}
              profileIdForVotes={profileId ?? currentUserId}
            />
          ))}
        </ul>
      )}
    </StickyHeaderLayout>
  );
}

/**
 * 概要: お題ヘッダー情報 (タイトル / 画像 / 回答数) をカード表示する。
 * Intent: 回答カードでは繰り返さないトピック文脈を 1 箇所にまとめ、モバイルでも視認性を確保する。
 * Contract:
 *   - topic.title / topic.created_at / topic.image をそのまま利用。
 *   - answerCount は 0 以上の整数。
 */
function TopicOverviewCard({
  topic,
  answerCount,
}: {
  topic: Topic;
  answerCount: number;
}) {
  let createdAtLabel: string | null = null;
  try {
    const created = new Date(topic.created_at);
    if (!Number.isNaN(created.getTime())) {
      createdAtLabel = created.toLocaleString();
    }
  } catch {
    createdAtLabel = null;
  }

  return (
    <section className="px-4 pt-4">
      <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/80 shadow-sm">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-1 font-semibold text-[11px] text-gray-600 dark:text-gray-200">
              お題
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              回答 {answerCount} 件
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-snug text-gray-900 dark:text-gray-100 break-words">
            {topic.title}
          </h2>
          {topic.image ? (
            <div className="block p-0 border rounded-md overflow-hidden">
              <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <img
                  src={topic.image}
                  alt={topic.title}
                  className="w-full h-auto max-h-40 object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          ) : null}
          {createdAtLabel ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              作成: {createdAtLabel}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
