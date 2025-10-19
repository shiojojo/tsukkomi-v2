import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from 'react-router';
import {
  AnswersRoute,
  AnswersErrorBoundary,
} from '~/components/common/AnswersRoute';
import { createAnswersLoader } from '~/lib/loaders/answersLoader';
import { handleAnswerActions } from '~/lib/actionHandlers';

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
  return <AnswersRoute mode="all" />;
}

export function ErrorBoundary() {
  return <AnswersErrorBoundary />;
}
