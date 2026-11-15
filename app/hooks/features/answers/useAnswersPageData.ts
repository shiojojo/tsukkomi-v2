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
  users: User[];
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
  const pageData: PageData = {
    ...loaderData,
    q: loaderData.q || '',
    author: loaderData.author || '',
    minScore: loaderData.minScore || 0,
    hasComments: loaderData.hasComments || false,
    fromDate: loaderData.fromDate || '',
    toDate: loaderData.toDate || '',
  };

  return { pageData, isLoading: false };
}