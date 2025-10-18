import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useNavigate } from 'react-router';
import { useEffect } from 'react';
import StickyHeaderLayout from '~/components/layout/StickyHeaderLayout';
import { AnswersPage } from '~/components/features/answers/AnswersPage';
import { useIdentity } from '~/hooks/common/useIdentity';
import { handleAnswerActions } from '~/lib/actionHandlers';
import { Button } from '~/components/ui/Button';
import { DEFAULT_PAGE_SIZE } from '~/lib/constants';
import type { Answer } from '~/lib/schemas/answer';
import { useAnswersPageData } from '~/hooks/features/answers/useAnswersPageData';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') ?? undefined;

  if (!profileId) {
    return Response.json({
      answers: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      q: '',
      author: '',
      sortBy: 'newest',
      minScore: 0,
      hasComments: false,
      fromDate: '',
      toDate: '',
      requiresProfileId: true,
      profileId: null,
    });
  }

  // answersリストデータだけを取得（最小限）
  const { createListLoader } = await import('~/lib/loaders');
  const listResponse = await createListLoader('answers', request, {
    favorite: true,
    profileId,
  });
  const listData = await listResponse.json();

  return Response.json({
    ...listData,
    requiresProfileId: false,
    profileId,
  });
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

  // 共通フックでデータ取得
  const { pageData, isLoading } = useAnswersPageData(loaderData);

  useEffect(() => {
    if (!requiresProfileId) return;
    if (!currentUserId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('profileId', currentUserId);
    navigate(`${url.pathname}${url.search}`, { replace: true });
  }, [requiresProfileId, currentUserId, navigate]);

  if (requiresProfileId && !currentUserId) {
    return (
      <StickyHeaderLayout
        header={
          <div className="header-base">
            <div className="p-4">
              <h1 className="text-lg font-semibold">お気に入り</h1>
            </div>
          </div>
        }
      >
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
      </StickyHeaderLayout>
    );
  }

  if (isLoading) {
    return (
      <StickyHeaderLayout
        header={
          <div className="header-base">
            <div className="p-4">
              <h1 className="text-lg font-semibold">お気に入り</h1>
            </div>
          </div>
        }
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading favorites...</div>
        </div>
      </StickyHeaderLayout>
    );
  }

  return <AnswersPage data={pageData} mode="favorites" />;
}
