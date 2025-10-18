import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from 'react-router';
import { useLoaderData } from 'react-router';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import { useQueryWithError } from '~/hooks/common/useQueryWithError';
import {
  getTopicsByIds,
  getUsers,
  getCommentsForAnswers,
  getFavoriteCounts,
  getUserAnswerData,
} from '~/lib/db';
import { mergeUserDataIntoAnswers } from '~/lib/utils/dataMerging';

// Simple in-memory guard to suppress very short-window duplicate POSTs.

export const meta: MetaFunction = () => {
  return [{ title: 'Tsukkomi V2' }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const topicId = url.searchParams.get('topicId') ?? undefined;
  const profileIdQuery = url.searchParams.get('profileId') ?? undefined;

  // answersリストデータだけを取得（最小限）
  const { createListLoader } = await import('~/lib/loaders');
  const listResponse = await createListLoader('answers', request, { topicId });
  const listData = await listResponse.json();

  return new Response(
    JSON.stringify({
      ...listData,
      profileId: profileIdQuery,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

import { handleAnswerActions } from '~/lib/actionHandlers';

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function AnswersRoute() {
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
    profileId?: string;
  };

  const answerIds = loaderData.answers.map(a => a.id);
  const topicIds = Array.from(
    new Set(loaderData.answers.map(a => a.topicId).filter(Boolean) as number[])
  );

  // 個別クエリで補助データを取得
  const topicsQuery = useQueryWithError(['topics', topicIds.join(',')], () =>
    getTopicsByIds(topicIds)
  );
  const usersQuery = useQueryWithError(['users'], () =>
    getUsers({ limit: 200 })
  );
  const commentsQuery = useQueryWithError(
    ['comments', answerIds.join(',')],
    () => getCommentsForAnswers(answerIds)
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
  const commentsByAnswer = commentsQuery.data || {};
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
    commentsQuery.isLoading ||
    favCountsQuery.isLoading ||
    userAnswerDataQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading answers...</div>
      </div>
    );
  }

  const data = {
    ...loaderData,
    answers: answersWithUserData,
    topicsById,
    commentsByAnswer,
    users,
    q: loaderData.q || '',
    author: loaderData.author || '',
    minScore: loaderData.minScore || 0,
    hasComments: loaderData.hasComments || false,
    fromDate: loaderData.fromDate || '',
    toDate: loaderData.toDate || '',
  };

  return <AnswersPage data={data} mode="all" />;
}

import type { Route } from './+types/answers._index';
import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';

export function ErrorBoundary({ error: _error }: Route.ErrorBoundaryProps) {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
