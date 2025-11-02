import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from 'react-router';
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

export const meta: MetaFunction = () => {
  return [{ title: 'Tsukkomi V2' }];
};

export async function loader(args: LoaderFunctionArgs) {
  return createAnswersLoader(args);
}

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
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
