import { useQueryWithError } from '~/hooks/common/useQueryWithError';
import {
  getTopicsByIds,
  getUsers,
  getCommentCountsForAnswers,
  getFavoriteCounts,
  getUserAnswerData,
} from '~/lib/db';
import { mergeUserDataIntoAnswers } from '~/lib/utils/dataMerging';
import { COMMENT_COUNTS_QUERY_OPTIONS } from '~/lib/constants';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { User } from '~/lib/schemas/user';

type LoaderData = {
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
  profileId?: string;
};

type PageData = LoaderData & {
  answers: Answer[];
  topicsById: Record<string, Topic>;
  commentCounts: Record<string, number>;
  users: User[];
  q: string;
  author: string;
  minScore: number;
  hasComments: boolean;
  fromDate: string;
  toDate: string;
};

export function useAnswersPageData(loaderData: LoaderData) {
  const answerIds = loaderData.answers.map(a => a.id);
  const topicIds = Array.from(
    new Set(loaderData.answers.map(a => a.topicId).filter(Boolean) as number[])
  );

  // 個別クエリで補助データを取得
  const topicsQuery = useQueryWithError(['topics', topicIds.join(',')], () =>
    getTopicsByIds(topicIds)
  );
  const usersQuery = useQueryWithError(['users'], () =>
    getUsers({ limit: 200 })
  );
  const commentCountsQuery = useQueryWithError(
    ['comment-counts', answerIds.join(',')],
    () => getCommentCountsForAnswers(answerIds),
    COMMENT_COUNTS_QUERY_OPTIONS
  );
  const favCountsQuery = useQueryWithError(
    ['favorite-counts', answerIds.join(',')],
    () => getFavoriteCounts(answerIds)
  );
  const userAnswerDataQuery = useQueryWithError(
    ['user-answer-data', loaderData.profileId || 'none', answerIds.join(',')],
    () =>
      loaderData.profileId
        ? getUserAnswerData(loaderData.profileId, answerIds)
        : Promise.resolve({ votes: {}, favorites: new Set<number>() }),
    { enabled: !!loaderData.profileId }
  );

  // データマージ
  const topicsById = topicsQuery.data
    ? Object.fromEntries(
        (topicsQuery.data as Topic[]).map(t => [String(t.id), t])
      )
    : {};
  const commentCounts = commentCountsQuery.data || {};
  const users = usersQuery.data || [];
  const favCounts = favCountsQuery.data || {};
  const userAnswerData = userAnswerDataQuery.data || {
    votes: {},
    favorites: new Set<number>(),
  };

  const answersWithUserData = mergeUserDataIntoAnswers(
    loaderData.answers,
    userAnswerData,
    favCounts,
    loaderData.profileId
  );

  // ローディング状態
  const isLoading =
    topicsQuery.isLoading ||
    usersQuery.isLoading ||
    commentCountsQuery.isLoading ||
    favCountsQuery.isLoading ||
    userAnswerDataQuery.isLoading;

  const pageData: PageData = {
    ...loaderData,
    answers: answersWithUserData,
    topicsById,
    commentCounts,
    users,
    q: loaderData.q || '',
    author: loaderData.author || '',
    minScore: loaderData.minScore || 0,
    hasComments: loaderData.hasComments || false,
    fromDate: loaderData.fromDate || '',
    toDate: loaderData.toDate || '',
  };

  return { pageData, isLoading };
}