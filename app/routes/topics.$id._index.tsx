import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useParams } from 'react-router';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import type { Answer } from '~/lib/schemas/answer';
import { useAnswersPageData } from '~/hooks/features/answers/useAnswersPageData';

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

  // 共通フックでデータ取得
  const { pageData, isLoading } = useAnswersPageData(loaderData);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading topic answers...</div>
      </div>
    );
  }

  const topic = pageData.topicsById[topicId];
  const data = {
    ...pageData,
    topicId,
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
