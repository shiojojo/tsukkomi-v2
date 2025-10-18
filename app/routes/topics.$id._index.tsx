import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useParams } from 'react-router';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import { useQueryWithError } from '~/hooks/common/useQueryWithError';
import {
  getTopicsByIds,
  getUsers,
  getCommentCountsForAnswers,
  getFavoriteCounts,
} from '~/lib/db';
import { mergeUserDataIntoAnswers } from '~/lib/utils/dataMerging';

// Simple in-memory guard to suppress very short-window duplicate POSTs.

export async function loader({ request, params }: LoaderFunctionArgs) {
  const topicId = params.id ? String(params.id) : undefined;

  // answersリストデータだけを取得（最小限）
  const { createListLoader } = await import('~/lib/loaders');
  const listResponse = await createListLoader('answers', request, { topicId });
  const listData = await listResponse.json();

  return new Response(
    JSON.stringify({
      ...listData,
      topicId,
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

export default function TopicDetailRoute() {
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
    topicId?: string;
  };

  const params = useParams();
  const topicId = params.id ? String(params.id) : '';
  const answerIds = loaderData.answers.map(a => a.id);
  const topicIds = topicId ? [Number(topicId)] : [];

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

  // データマージ
  const topicsById = topicsQuery.data
    ? Object.fromEntries(
        (topicsQuery.data as Topic[]).map(t => [String(t.id), t])
      )
    : {};
  const commentCounts = commentCountsQuery.data || {};
  const users = usersQuery.data || [];
  const favCounts = favCountsQuery.data || {};
  const userAnswerData = {
    votes: {},
    favorites: new Set<number>(),
  };

  const answersWithUserData = mergeUserDataIntoAnswers(
    loaderData.answers,
    userAnswerData,
    favCounts
  );

  // ローディング状態
  const isLoading =
    topicsQuery.isLoading ||
    usersQuery.isLoading ||
    commentCountsQuery.isLoading ||
    favCountsQuery.isLoading;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading topic answers...</div>
      </div>
    );
  }

  const topic = topicsById[topicId];
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

  return (
    <AnswersPage data={data} mode="topic" topicId={topicId} topic={topic} />
  );
}

import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';

export function ErrorBoundary() {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
