import type { Answer } from '~/lib/schemas/answer';

export type AnswersPageLoaderData = {
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

export type AnswersPageMode = 'all' | 'favorites' | 'topic';