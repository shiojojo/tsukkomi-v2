import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import StickyHeaderLayout from '~/components/layout/StickyHeaderLayout';
import { AnswersList } from '~/components/features/answers/AnswersList';
import { useAnswerUserData } from '~/hooks/useAnswerUserData';
import { useIdentity } from '~/hooks/useIdentity';
import { useNameByProfileId } from '~/hooks/useNameByProfileId';
import { handleAnswerActions } from '~/lib/actionHandlers';
import type { Comment } from '~/lib/schemas/comment';
import type { Topic } from '~/lib/schemas/topic';
import type { Answer } from '~/lib/schemas/answer';
import { HEADER_BASE } from '~/styles/headerStyles';

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
export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

/**
 * お題詳細ページ本体。回答カードを AnswerActionCard に統一し、/answers と同じ UI/UX を提供する。
 */
export default function TopicDetailRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const { topic, answers, commentsByAnswer, users, profileId } =
    useLoaderData() as LoaderData;

  const { nameByProfileId, getNameByProfileId } = useNameByProfileId(users);

  const { effectiveId: currentUserId, effectiveName: currentUserName } =
    useIdentity();

  const answerIds = useMemo(() => answers.map(answer => answer.id), [answers]);
  const { data: userAnswerData, markFavorite } = useAnswerUserData(answerIds);

  return (
    <StickyHeaderLayout
      header={
        <div className={HEADER_BASE}>
          <div className="p-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              お題詳細
            </h1>
          </div>
        </div>
      }
    >
      <TopicOverviewCard topic={topic} answerCount={answers.length} />
      <AnswersList
        answers={answers}
        topic={topic}
        commentsByAnswer={commentsByAnswer}
        getNameByProfileId={getNameByProfileId}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        userAnswerData={userAnswerData}
        onFavoriteUpdate={markFavorite}
        actionPath={`/topics/${topic.id}`}
        profileIdForVotes={profileId ?? currentUserId}
        emptyMessage="まだ回答が投稿されていません。"
      />
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
