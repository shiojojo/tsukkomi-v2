import type { LoaderFunctionArgs } from 'react-router';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface CommonFilterParams {
  q?: string;
  fromDate?: string;
  toDate?: string;
}

export function parsePaginationParams(request: LoaderFunctionArgs['request']): PaginationParams {
  const url = new URL(request.url);
  const params = url.searchParams;
  return {
    page: Number(params.get('page') ?? '1'),
    pageSize: Number(params.get('pageSize') ?? '10'),
  };
}

export function parseCommonFilterParams(request: LoaderFunctionArgs['request']): CommonFilterParams {
  const url = new URL(request.url);
  const params = url.searchParams;
  return {
    q: params.get('q') ?? undefined,
    fromDate: params.get('fromDate') ?? undefined,
    toDate: params.get('toDate') ?? undefined,
  };
}

// answers 固有のフィルタ
export interface AnswersFilterParams extends CommonFilterParams {
  author?: string;
  sortBy: 'newest' | 'oldest' | 'scoreDesc';
  minScore?: number;
  hasComments?: boolean;
}

export function parseAnswersFilterParams(request: LoaderFunctionArgs['request']): AnswersFilterParams {
  const common = parseCommonFilterParams(request);
  const url = new URL(request.url);
  const params = url.searchParams;
  return {
    ...common,
    author: params.get('authorName') ?? undefined,
    sortBy: (params.get('sortBy') as any) ?? 'newest',
    minScore: params.get('minScore') ? Number(params.get('minScore')) : undefined,
    hasComments: params.get('hasComments') === '1' || params.get('hasComments') === 'true',
  };
}

// topics 固有のフィルタ（今のところ common と同じ）
export type TopicsFilterParams = CommonFilterParams;