import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useParams } from 'react-router';
import {
  AnswersRoute,
  AnswersErrorBoundary,
} from '~/components/common/AnswersRoute';
import { createAnswersLoader } from '~/lib/loaders/answersLoader';
import { handleAnswerActions } from '~/lib/actionHandlers';

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

  return <AnswersRoute mode="topic" topicId={topicId} />;
}

export function ErrorBoundary() {
  return <AnswersErrorBoundary />;
}
