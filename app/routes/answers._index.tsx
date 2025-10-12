import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from 'react-router';
import { useLoaderData } from 'react-router';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import type { User } from '~/lib/schemas/user';

// Simple in-memory guard to suppress very short-window duplicate POSTs.

export const meta: MetaFunction = () => {
  return [{ title: 'Tsukkomi V2' }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const topicId = url.searchParams.get('topicId') ?? undefined;
  const { createAnswersListLoader } = await import('~/lib/loaders');
  return await createAnswersListLoader(request, { topicId });
}

import { handleAnswerActions } from '~/lib/actionHandlers';

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function AnswersRoute() {
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
    profileId?: string;
  };

  return <AnswersPage data={data} mode="all" />;
}

import { isRouteErrorResponse } from 'react-router';
import type { Route } from './+types/answers._index';
import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
