import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from 'react-router';
import { useLoaderData } from 'react-router';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import type { Answer } from '~/lib/schemas/answer';
import { useAnswersPageData } from '~/hooks/features/answers/useAnswersPageData';

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

  const { pageData, isLoading } = useAnswersPageData(loaderData);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading answers...</div>
      </div>
    );
  }

  return <AnswersPage data={pageData} mode="all" />;
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
