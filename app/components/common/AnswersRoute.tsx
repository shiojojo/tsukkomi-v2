import { useLoaderData } from 'react-router';
import { lazy, Suspense } from 'react';
import { LoadingState } from '~/components/common/LoadingState';
import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';
import { useAnswersPageData } from '~/hooks/features/answers/useAnswersPageData';
import type {
  AnswersPageLoaderData,
  AnswersPageMode,
} from '~/lib/types/answersPage';

// Lazy load AnswersPage to reduce initial bundle size
const AnswersPage = lazy(() =>
  import('~/components/features/answers/AnswersPage').then(module => ({
    default: module.AnswersPage,
  }))
);

interface AnswersRouteProps {
  mode: AnswersPageMode;
  topicId?: string;
}

export function AnswersRoute({ mode, topicId }: AnswersRouteProps) {
  const loaderData = useLoaderData() as AnswersPageLoaderData;
  const { pageData, isLoading } = useAnswersPageData(loaderData);

  if (isLoading) {
    const messages = {
      all: 'Loading answers...',
      favorites: 'Loading favorites...',
      topic: 'Loading topic answers...',
    };
    return <LoadingState message={messages[mode]} />;
  }

  const topic =
    mode === 'topic' && topicId ? pageData.topicsById[topicId] : undefined;
  const data = mode === 'topic' ? { ...pageData, topicId } : pageData;

  return (
    <Suspense fallback={<LoadingState message="Loading answers page..." />}>
      <AnswersPage data={data} mode={mode} topicId={topicId} topic={topic} />
    </Suspense>
  );
}

export function AnswersErrorBoundary() {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
