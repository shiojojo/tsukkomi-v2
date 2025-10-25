import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { User } from '~/lib/schemas/user';

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
  users: User[];
};

export type AnswersPageMode = 'all' | 'favorites' | 'topic';