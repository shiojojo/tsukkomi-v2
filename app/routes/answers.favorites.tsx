import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useNavigate } from 'react-router';
import { useEffect } from 'react';
import StickyHeaderLayout from '~/components/layout/StickyHeaderLayout';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import { useIdentity } from '~/hooks/common/useIdentity';
import { handleAnswerActions } from '~/lib/actionHandlers';
import { Button } from '~/components/ui/Button';
import { DEFAULT_PAGE_SIZE } from '~/lib/constants';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import { useQueryWithError } from '~/hooks/common/useQueryWithError';
import {
  getTopicsByIds,
  getUsers,
  getCommentCountsForAnswers,
  getFavoriteCounts,
  getUserAnswerData,
} from '~/lib/db';
import { mergeUserDataIntoAnswers } from '~/lib/utils/dataMerging';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') ?? undefined;

  if (!profileId) {
    return Response.json({
      answers: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      q: '',
      author: '',
      sortBy: 'newest',
      minScore: 0,
      hasComments: false,
      fromDate: '',
      toDate: '',
      requiresProfileId: true,
      profileId: null,
    });
  }

  // answersリストデータだけを取得（最小限）
  const { createListLoader } = await import('~/lib/loaders');
  const listResponse = await createListLoader('answers', request, {
    favorite: true,
    profileId,
  });
  const listData = await listResponse.json();

  return Response.json({
    ...listData,
    requiresProfileId: false,
    profileId,
  });
}

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function FavoriteAnswersRoute() {
  const loaderData = useLoaderData() as {
    answers: Answer[];
    total: number;
    page: number;
    pageSize: number;
    q?: string;
    author?: string;
    sortBy: string;
    minScore?: number;
    hasComments?: boolean;
    fromDate?: string;
    toDate?: string;
    requiresProfileId: boolean;
    profileId?: string;
  };

  const requiresProfileId = loaderData.requiresProfileId;
  const answerIds = loaderData.answers.map(a => a.id);
  const topicIds = Array.from(
    new Set(loaderData.answers.map(a => a.topicId).filter(Boolean) as number[])
  );

  const { effectiveId: currentUserId } = useIdentity();
  const navigate = useNavigate();

  useEffect(() => {
    if (!requiresProfileId) return;
    if (!currentUserId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('profileId', currentUserId);
    navigate(`${url.pathname}${url.search}`, { replace: true });
  }, [requiresProfileId, currentUserId, navigate]);

  if (requiresProfileId && !currentUserId) {
    return (
      <StickyHeaderLayout
        header={
          <div className="header-base">
            <div className="p-4">
              <h1 className="text-lg font-semibold">お気に入り</h1>
            </div>
          </div>
        }
      >
        <div className="px-4 py-8 space-y-4">
          <p className="text-sm text-gray-600">
            お気に入り一覧を表示するには、まずログインしてユーザーを選択してください。
          </p>
          <Form method="get" action="/login" className="inline">
            <Button variant="small" active={false}>
              ログインへ
            </Button>
          </Form>
        </div>
      </StickyHeaderLayout>
    );
  }

  // 個別クエリで補助データを取得
  const topicsQuery = useQueryWithError(['topics', topicIds.join(',')], () =>
    getTopicsByIds(topicIds)
  );
  const usersQuery = useQueryWithError(['users'], () =>
    getUsers({ limit: 200 })
  );
  const commentCountsQuery = useQueryWithError(
    ['comment-counts', answerIds.join(',')],
    () => getCommentCountsForAnswers(answerIds)
  );
  const favCountsQuery = useQueryWithError(
    ['favorite-counts', answerIds.join(',')],
    () => getFavoriteCounts(answerIds)
  );
  const userAnswerDataQuery = useQueryWithError(
    ['user-answer-data', loaderData.profileId || 'none', answerIds.join(',')],
    () =>
      loaderData.profileId
        ? getUserAnswerData(loaderData.profileId, answerIds)
        : Promise.resolve({ votes: {}, favorites: new Set<number>() }),
    { enabled: !!loaderData.profileId }
  );

  // データマージ
  const topicsById = topicsQuery.data
    ? Object.fromEntries(
        (topicsQuery.data as Topic[]).map(t => [String(t.id), t])
      )
    : {};
  const commentCounts = commentCountsQuery.data || {};
  const users = usersQuery.data || [];
  const favCounts = favCountsQuery.data || {};
  const userAnswerData = userAnswerDataQuery.data || {
    votes: {},
    favorites: new Set<number>(),
  };

  const answersWithUserData = mergeUserDataIntoAnswers(
    loaderData.answers,
    userAnswerData,
    favCounts,
    loaderData.profileId
  );

  // ローディング状態
  const isLoading =
    topicsQuery.isLoading ||
    usersQuery.isLoading ||
    commentCountsQuery.isLoading ||
    favCountsQuery.isLoading ||
    userAnswerDataQuery.isLoading;

  if (isLoading) {
    return (
      <StickyHeaderLayout
        header={
          <div className="header-base">
            <div className="p-4">
              <h1 className="text-lg font-semibold">お気に入り</h1>
            </div>
          </div>
        }
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading favorites...</div>
        </div>
      </StickyHeaderLayout>
    );
  }

  const data = {
    ...loaderData,
    answers: answersWithUserData,
    topicsById,
    commentCounts,
    users,
    q: loaderData.q || '',
    author: loaderData.author || '',
    minScore: loaderData.minScore || 0,
    hasComments: loaderData.hasComments || false,
    fromDate: loaderData.fromDate || '',
    toDate: loaderData.toDate || '',
  };

  return <AnswersPage data={data} mode="favorites" />;
}
