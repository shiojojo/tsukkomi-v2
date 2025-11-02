import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useParams } from 'react-router';
import { lazy, Suspense } from 'react';
import { LoadingState } from '~/components/common/LoadingState';
import { createAnswersLoader } from '~/lib/loaders/answersLoader';
import { handleAnswerActions } from '~/lib/actionHandlers';

// Lazy load the main component to reduce initial bundle size
const AnswersRoute = lazy(() =>
  import('~/components/common/AnswersRoute').then(module => ({
    default: module.AnswersRoute,
  }))
);

const AnswersErrorBoundary = lazy(() =>
  import('~/components/common/AnswersRoute').then(module => ({
    default: module.AnswersErrorBoundary,
  }))
);

export async function loader(args: LoaderFunctionArgs) {
  const params = args.params;
  const topicId = params.id ? String(params.id) : undefined;
  return createAnswersLoader(args, { topicId });
}

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function TopicDetailRoute() {
  const params = useParams();
  const topicId = params.id ? String(params.id) : '';

  return (
    <Suspense fallback={<LoadingState message="Loading topic answers..." />}>
      <AnswersRoute mode="topic" topicId={topicId} />
    </Suspense>
  );
}

export function ErrorBoundary() {
  return <AnswersErrorBoundary />;
}
