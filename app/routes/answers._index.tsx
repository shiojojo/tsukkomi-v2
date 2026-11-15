import type {
  LoaderFunctionArgs,
  MetaFunction,
} from 'react-router';
import { lazy, Suspense } from 'react';
import { LoadingState } from '~/components/common/LoadingState';
import { createAnswersLoader } from '~/lib/loaders/answersLoader';

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

export const meta: MetaFunction = () => {
  return [{ title: 'Tsukkomi V2' }];
};

export async function loader(args: LoaderFunctionArgs) {
  return createAnswersLoader(args);
}

export default function AnswersRouteComponent() {
  return (
    <Suspense fallback={<LoadingState message="Loading answers..." />}>
      <AnswersRoute mode="all" />
    </Suspense>
  );
}

export function ErrorBoundary() {
  return <AnswersErrorBoundary />;
}
