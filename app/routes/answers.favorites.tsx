import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useNavigate } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import StickyHeaderLayout from '~/components/StickyHeaderLayout';
import { AnswersList } from '~/components/AnswersList';
import { useAnswerUserData } from '~/hooks/useAnswerUserData';
import { useIdentity } from '~/hooks/useIdentity';
import { handleAnswerActions } from '~/lib/actionHandlers';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';
import { logger } from '~/lib/logger';
import { consumeToken } from '~/lib/rateLimiter';

const _recentPostGuard = new Map<string, number>();

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') ?? undefined;

  const base = {
    answers: [] as Answer[],
    topicsById: {} as Record<string, Topic>,
    commentsByAnswer: {} as Record<string, Comment[]>,
    users: [] as User[],
    requiresProfileId: true,
    profileId: profileId ?? null,
  };

  if (!profileId) {
    return base;
  }

  const {
    getFavoriteAnswersForProfile,
    getTopics,
    getCommentsForAnswers,
    getUsers,
  } = await import('~/lib/db');

  const answers = await getFavoriteAnswersForProfile(profileId);
  const answerIds = answers.map(a => a.id);
  const commentsByAnswer = answerIds.length
    ? await getCommentsForAnswers(answerIds)
    : {};
  const topics = await getTopics();
  const topicsById = Object.fromEntries(topics.map(t => [String(t.id), t]));
  const users = await getUsers({ limit: 500 });

  return {
    answers,
    topicsById,
    commentsByAnswer,
    users,
    requiresProfileId: false,
    profileId,
  };
}

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function FavoriteAnswersRoute() {
  type LoaderData = Awaited<ReturnType<typeof loader>>;
  const data = useLoaderData() as LoaderData;
  const answers = data.answers ?? [];
  const topicsById = data.topicsById ?? {};
  const commentsByAnswer = data.commentsByAnswer ?? {};
  const users: User[] = data.users ?? [];
  const requiresProfileId = data.requiresProfileId;
  const profileIdFromLoader = data.profileId ?? null;

  const nameByProfileId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const user of users) {
      map[String(user.id)] = user.name;
      for (const sub of user.subUsers ?? []) {
        map[String(sub.id)] = sub.name;
      }
    }
    return map;
  }, [users]);

  const { effectiveId: currentUserId, effectiveName: currentUserName } =
    useIdentity();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!requiresProfileId) return;
    if (!currentUserId) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('profileId', currentUserId);
      navigate(`${url.pathname}${url.search}`, { replace: true });
    } catch {}
  }, [requiresProfileId, currentUserId, navigate]);

  const [visibleAnswers, setVisibleAnswers] = useState<Answer[]>(answers);
  const [currentCommentsByAnswer, setCurrentCommentsByAnswer] =
    useState<Record<string, Comment[]>>(commentsByAnswer);

  useEffect(() => {
    setVisibleAnswers(answers);
  }, [answers]);

  useEffect(() => {
    setCurrentCommentsByAnswer(commentsByAnswer);
  }, [commentsByAnswer]);

  const answerIds = visibleAnswers.map((a: Answer) => a.id);
  const { data: userAnswerData, markFavorite } = useAnswerUserData(
    answerIds,
    Boolean(currentUserId)
  );

  const getNameByProfileId = (pid?: string | null) => {
    if (!pid) return undefined;
    return nameByProfileId[String(pid)];
  };

  const headerNode = (
    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">お気に入り</h1>
          <Form method="get" action="/answers" className="hidden md:block">
            <button className="text-sm text-blue-600 hover:underline">
              回答一覧へ
            </button>
          </Form>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-300">
          保存した回答をまとめて採点・コメントできます。
        </p>
      </div>
    </div>
  );

  if (requiresProfileId && !currentUserId) {
    return (
      <StickyHeaderLayout header={headerNode}>
        <div className="px-4 py-8 space-y-4">
          <p className="text-sm text-gray-600">
            お気に入り一覧を表示するには、まずログインしてユーザーを選択してください。
          </p>
          <Form method="get" action="/login" className="inline">
            <button className="btn-inline">ログインへ</button>
          </Form>
        </div>
      </StickyHeaderLayout>
    );
  }

  if (!answers.length) {
    return (
      <StickyHeaderLayout header={headerNode}>
        <div className="px-4 py-8 space-y-3">
          <h2 className="text-lg font-semibold">お気に入りはまだありません</h2>
          <p className="text-sm text-gray-600">
            /answers
            から気になる回答をお気に入り登録しておくと、ここでまとめて採点やコメントができます。
          </p>
          <Form method="get" action="/answers" className="inline">
            <button className="btn-inline">回答一覧へ戻る</button>
          </Form>
        </div>
      </StickyHeaderLayout>
    );
  }

  return (
    <StickyHeaderLayout header={headerNode}>
      <div className="px-4 pb-20">
        <h2 className="text-lg font-semibold mb-4">お気に入りの回答</h2>
        <p className="text-sm text-gray-600 mb-6">
          保存した回答に対して、採点とコメントができます。採点は 1〜3 の 3
          段階です。
        </p>
        {visibleAnswers.length === 0 ? (
          <div className="py-10 text-sm text-gray-500">
            すべてのお気に入りが解除されました。新しいお気に入りを追加するとここに表示されます。
          </div>
        ) : (
          <AnswersList
            answers={visibleAnswers}
            topicsById={topicsById}
            commentsByAnswer={currentCommentsByAnswer}
            getNameByProfileId={getNameByProfileId}
            currentUserName={currentUserName}
            currentUserId={currentUserId}
            userAnswerData={userAnswerData}
            onFavoriteUpdate={(id: number, favorited: boolean) => {
              markFavorite(id, favorited);
              if (!favorited) {
                setVisibleAnswers(prev => prev.filter(a => a.id !== id));
              }
            }}
            actionPath="/answers/favorites"
            profileIdForVotes={profileIdFromLoader ?? currentUserId}
            emptyMessage="すべてのお気に入りが解除されました。新しいお気に入りを追加するとここに表示されます。"
          />
        )}
      </div>
    </StickyHeaderLayout>
  );
}
