import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useNavigate } from 'react-router';
import { useEffect } from 'react';
import { AnswersRoute } from '~/components/common/AnswersRoute';
import { useIdentity } from '~/hooks/common/useIdentity';
import { handleAnswerActions } from '~/lib/actionHandlers';
import { Button } from '~/components/ui/Button';
import { createAnswersLoader } from '~/lib/loaders/answersLoader';
import type { Answer } from '~/lib/schemas/answer';

export async function loader(args: LoaderFunctionArgs) {
  return createAnswersLoader(args, { requiresAuth: true, favorite: true });
}

export async function action(args: ActionFunctionArgs) {
  return handleAnswerActions(args);
}

export default function FavoriteAnswersRoute() {
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
    requiresProfileId: boolean;
    profileId?: string;
  };

  const requiresProfileId = loaderData.requiresProfileId;
  const { effectiveId: currentUserId } = useIdentity();
  const navigate = useNavigate();

  useEffect(() => {
    if (!requiresProfileId) return;
    if (!currentUserId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('profileId', currentUserId);
    navigate(`${url.pathname}${url.search}`, { replace: true });
  }, [requiresProfileId, currentUserId, navigate]);

  if (requiresProfileId && !currentUserId) {
    return (
      <div className="px-4 py-8 space-y-4">
        <p className="text-sm text-gray-600">
          お気に入り一覧を表示するには、まずログインしてユーザーを選択してください。
        </p>
        <Form method="get" action="/login" className="inline">
          <Button variant="small" active={false}>
            ログインへ
          </Button>
        </Form>
      </div>
    );
  }

  return <AnswersRoute mode="favorites" />;
}
