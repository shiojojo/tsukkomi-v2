import type { LoaderFunctionArgs } from 'react-router';
import { DEFAULT_PAGE_SIZE } from '~/lib/constants';
import { getTopicsByIds } from '~/lib/db/topics';
import type { Answer } from '~/lib/schemas/answer';

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
      topicsById: {},
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

  // 回答に含まれる全トピックIDを取得してトピック情報を取得
  const topicIds = Array.from(
    new Set((listData.answers as Answer[]).map(a => a.topicId).filter(Boolean) as number[])
  );
  const topics = topicIds.length > 0 ? await getTopicsByIds(topicIds) : [];
  const topicsById = Object.fromEntries(
    topics.map(t => [String(t.id), t])
  );

  const responseData = {
    ...listData,
    profileId: profileIdQuery,
    topicsById,
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