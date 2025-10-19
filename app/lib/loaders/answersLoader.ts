import type { LoaderFunctionArgs } from 'react-router';
import { DEFAULT_PAGE_SIZE } from '~/lib/constants';

export interface CreateAnswersLoaderOptions {
  topicId?: string;
  favorite?: boolean;
  profileId?: string;
  requiresAuth?: boolean;
}

export async function createAnswersLoader(
  { request }: LoaderFunctionArgs,
  options: CreateAnswersLoaderOptions = {}
) {
  const url = new URL(request.url);
  const profileIdQuery = url.searchParams.get('profileId') ?? undefined;

  // 認証が必要なページでprofileIdがない場合
  if (options.requiresAuth && !profileIdQuery) {
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
    topicId: options.topicId,
    favorite: options.favorite,
    profileId: options.profileId || profileIdQuery,
  });
  const listData = await listResponse.json();

  const responseData = {
    ...listData,
    profileId: profileIdQuery,
    ...(options.topicId && { topicId: options.topicId }),
    ...(options.requiresAuth && { requiresProfileId: false }),
  };

  return new Response(
    JSON.stringify(responseData),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}