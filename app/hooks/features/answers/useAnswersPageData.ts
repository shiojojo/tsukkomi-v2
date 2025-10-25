import { useQueryWithError } from '~/hooks/common/useQueryWithError';
import {
  getUsers,
  getUserAnswerData,
} from '~/lib/db';
import { mergeUserDataIntoAnswers } from '~/lib/utils/dataMerging';
import { useIdentity } from '~/hooks/common/useIdentity';
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
  topicsById: Record<string, Topic>;
};

type PageData = LoaderData & {
  answers: Answer[];
  topicsById: Record<string, Topic>;
  users: User[];
  q: string;
  author: string;
  minScore: number;
  hasComments: boolean;
  fromDate: string;
  toDate: string;
};

export function useAnswersPageData(loaderData: LoaderData) {
  const { effectiveId: clientProfileId } = useIdentity();
  const profileId = loaderData.profileId || clientProfileId;

  const answerIds = loaderData.answers.map(a => a.id);

  // 個別クエリで補助データを取得（トピックはLoaderから直接使用）
  const usersQuery = useQueryWithError(['users'], () =>
    getUsers({ limit: 200 })
  );
  const userAnswerDataQuery = useQueryWithError(
    ['user-answer-data', profileId || 'none', answerIds.join(',')],
    () =>
      profileId
        ? getUserAnswerData(profileId, answerIds)
        : Promise.resolve({ votes: {}, favorites: new Set<number>() }),
    { enabled: !!profileId }
  );

  // データマージ（トピックはLoaderから直接使用）
  const users = usersQuery.data || [];
  const userAnswerData = userAnswerDataQuery.data || {
    votes: {},
    favorites: new Set<number>(),
  };

  const answersWithUserData = mergeUserDataIntoAnswers(
    loaderData.answers,
    userAnswerData,
    profileId || undefined
  );

  // ローディング状態（トピックのQueryは削除）
  const isLoading =
    usersQuery.isLoading ||
    userAnswerDataQuery.isLoading;

  const pageData: PageData = {
    ...loaderData,
    answers: answersWithUserData,
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