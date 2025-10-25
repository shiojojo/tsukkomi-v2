import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';

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
  topicsById: Record<string, Topic>;
};

export type AnswersPageMode = 'all' | 'favorites' | 'topic';