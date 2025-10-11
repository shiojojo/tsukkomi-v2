import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useParams } from 'react-router';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import { DEFAULT_PAGE_SIZE } from '~/lib/constants';

// Simple in-memory guard to suppress very short-window duplicate POSTs.

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const topicId = params.id ? String(params.id) : undefined;
    const { createAnswersListLoader } = await import('~/lib/loaders');
    return await createAnswersListLoader(request, { topicId });
  } catch (error) {
    console.error('Failed to load topic answers:', error);
    // Return a safe fallback response
    return Response.json({
      answers: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      q: '',
      author: '',
      sortBy: 'created_at',
      fromDate: '',
      toDate: '',
      topicsById: {},
      commentsByAnswer: {},
      users: [],
    });
  }
}

import { handleAnswerActions } from '~/lib/actionHandlers';

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function TopicDetailRoute() {
  const data = useLoaderData() as {
    answers: any[];
    total: number;
    page: number;
    pageSize: number;
    q: string;
    author: string;
    sortBy: string;
    minScore: number;
    hasComments: boolean;
    fromDate: string;
    toDate: string;
    topicsById: Record<string, any>;
    commentsByAnswer: Record<string, any[]>;
    users: any[];
  };
  const params = useParams();

  const topicId = params.id ? String(params.id) : '';
  const topic = data.topicsById[topicId];

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
