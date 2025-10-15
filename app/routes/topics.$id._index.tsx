import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useParams } from 'react-router';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';

// Simple in-memory guard to suppress very short-window duplicate POSTs.

export async function loader({ request, params }: LoaderFunctionArgs) {
  const topicId = params.id ? String(params.id) : undefined;
  const { createAnswersListLoader } = await import('~/lib/loaders');
  return await createAnswersListLoader(request, { topicId });
}

import { handleAnswerActions } from '~/lib/actionHandlers';

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function TopicDetailRoute() {
  const data = useLoaderData() as {
    answers: Answer[];
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
    topicsById: Record<string, Topic>;
    commentsByAnswer: Record<string, Comment[]>;
    users: User[];
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
