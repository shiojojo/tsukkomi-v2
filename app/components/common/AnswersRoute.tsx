import { useLoaderData } from 'react-router';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import { LoadingState } from '~/components/common/LoadingState';
import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';
import { useAnswersPageData } from '~/hooks/features/answers/useAnswersPageData';
import type {
  AnswersPageLoaderData,
  AnswersPageMode,
} from '~/lib/types/answersPage';

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
    <AnswersPage data={data} mode={mode} topicId={topicId} topic={topic} />
  );
}

export function AnswersErrorBoundary() {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
