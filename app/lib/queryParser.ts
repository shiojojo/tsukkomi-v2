import { DEFAULT_PAGE_SIZE } from './constants';

export type QuerySource = Request | URL;

function getSearchParams(source: QuerySource): URLSearchParams {
  return source instanceof URL
    ? source.searchParams
    : new URL(source.url).searchParams;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface CommonFilterParams {
  q?: string;
  fromDate?: string;
  toDate?: string;
}

export type SortBy = 'newest' | 'oldest' | 'scoreDesc';

export function parsePaginationParams(source: QuerySource): PaginationParams {
  const params = getSearchParams(source);
  return {
    page: Number(params.get('page') ?? '1'),
    pageSize: Number(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE)),
  };
}

export function parseCommonFilterParams(source: QuerySource): CommonFilterParams {
  const params = getSearchParams(source);
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

export function parseAnswersFilterParams(source: QuerySource): AnswersFilterParams {
  const common = parseCommonFilterParams(source);
  const params = getSearchParams(source);
  return {
    ...common,
    author: params.get('author') ?? undefined,
    sortBy: (params.get('sortBy') as SortBy) ?? 'newest',
    minScore: params.get('minScore') ? Number(params.get('minScore')) : undefined,
    hasComments: params.get('hasComments') === '1' || params.get('hasComments') === 'true',
  };
}

// topics 固有のフィルタ（今のところ common と同じ）
export type TopicsFilterParams = CommonFilterParams;

export type FilterParams = CommonFilterParams | AnswersFilterParams;

export function parseFilterParams(source: QuerySource, entityType: 'topics' | 'answers'): FilterParams {
  if (entityType === 'topics') {
    return parseCommonFilterParams(source);
  } else {
    return parseAnswersFilterParams(source);
  }
}
