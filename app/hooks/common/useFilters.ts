import { useState, useEffect } from 'react';

export type AnswersFilters = {
  q: string;
  author: string;
  sortBy: 'newest' | 'oldest' | 'scoreDesc';
  minScore: string;
  hasComments: boolean;
  fromDate: string;
  toDate: string;
};

export type TopicsFilters = {
  q: string;
  fromDate: string;
  toDate: string;
};

export type Filters = AnswersFilters | TopicsFilters;

/**
 * カスタムフック: フィルタ状態の管理とURL同期
 * @param initialValues 初期値（loaderから渡す場合）
 * @param urlKeys URLパラメータ名とのマッピング
 * @param useUrlInit URLから初期化するかどうか（デフォルト: true）
 * @returns フィルタ状態と更新関数
 */
export function useFilters<T extends Record<string, any>>(
  initialValues: T,
  urlKeys: Record<keyof T, string>,
  useUrlInit: boolean = true
) {
  const [filters, setFilters] = useState<T>(initialValues);

  // URLから初期化
  useEffect(() => {
    if (!useUrlInit) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const urlValues: Partial<T> = {};

      for (const [key, urlKey] of Object.entries(urlKeys) as [keyof T, string][]) {
        const value = params.get(urlKey);
        if (value !== null) {
          // 型に応じて変換
          if (typeof initialValues[key] === 'boolean') {
            urlValues[key] = (value === '1' || value === 'true') as T[keyof T];
          } else if (typeof initialValues[key] === 'number') {
            urlValues[key] = Number(value) as T[keyof T];
          } else {
            urlValues[key] = value as T[keyof T];
          }
        }
      }

      setFilters(prev => ({ ...prev, ...urlValues }));
    } catch (error) {
      console.warn('Failed to initialize filters from URL:', error);
    }
  }, [useUrlInit, urlKeys, initialValues]);

  const updateFilter = <K extends keyof T>(key: K, value: T[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(initialValues);
  };

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
  };
}