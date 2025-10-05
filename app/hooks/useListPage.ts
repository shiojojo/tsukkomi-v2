import { useEffect, useRef } from 'react';
import { useFilters, type TopicsFilters, type AnswersFilters } from './useFilters';

type FilterType = 'topics' | 'answers';

interface BaseLoaderData {
  total: number;
  page: number;
  pageSize: number;
  q?: string;
  fromDate?: string;
  toDate?: string;
}

interface TopicsLoaderData extends BaseLoaderData {
  topics: any[];
}

interface AnswersLoaderData extends BaseLoaderData {
  answers: any[];
  // answers 固有の追加フィールド
  author?: string;
  sortBy?: string;
  minScore?: string;
  hasComments?: boolean;
}

type LoaderData = TopicsLoaderData | AnswersLoaderData;

/**
 * 概要: リストページの共通ロジックを管理するカスタムフック。
 * Contract:
 *   - Input: loaderData (loader からのデータ), filterType ('topics' | 'answers'), urlKeys (URLパラメータマッピング), entityKey ('topics' | 'answers')
 *   - Output: フィルタ状態、更新関数、ページネーション情報、スクロールref
 * Environment: ブラウザ専用
 * Errors: なし
 */
export function useListPage(
  loaderData: LoaderData,
  filterType: FilterType,
  urlKeys: Record<string, string>,
  entityKey: 'topics' | 'answers'
) {
  const {
    total,
    page: currentPage,
    pageSize,
    q,
    fromDate,
    toDate,
    ...extraData
  } = loaderData;

  // フィルタの初期値設定
  const initialFilters: TopicsFilters | AnswersFilters =
    filterType === 'topics'
      ? {
          q: q || '',
          fromDate: fromDate || '',
          toDate: toDate || '',
        }
      : {
          q: q || '',
          author: (extraData as AnswersLoaderData).author || '',
          sortBy: ((extraData as AnswersLoaderData).sortBy as any) || 'newest',
          minScore: (extraData as AnswersLoaderData).minScore || '',
          hasComments: (extraData as AnswersLoaderData).hasComments || false,
          fromDate: fromDate || '',
          toDate: toDate || '',
        };

  const { filters, updateFilter } = useFilters(initialFilters, urlKeys, false);

  // ページネーション計算
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // リストデータ
  const listData = (loaderData as any)[entityKey] || [];

  // スクロールリセット用 ref
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ページ変更時のスクロールリセット
  useEffect(() => {
    try {
      const el = containerRef.current as HTMLDivElement | null;
      if (el) {
        el.scrollTop = 0;
        try {
          el.scrollTo?.({ top: 0, behavior: 'auto' } as any);
        } catch {}
      }

      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    } catch {}
  }, [currentPage]);

  return {
    filters,
    updateFilter,
    pageCount,
    currentPage,
    pageSize,
    total,
    listData,
    containerRef,
  };
}