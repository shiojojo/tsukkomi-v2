import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useFilters, type AnswersFilters, type TopicsFilters } from '~/hooks/useFilters';

// Mock window.location
const mockLocation = {
  search: '',
  pathname: '/test',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('useFilters', () => {
  beforeEach(() => {
    // Reset location before each test
    mockLocation.search = '';
  });

  describe('初期化', () => {
    it('初期値が正しく設定される', () => {
      const initialValues: TopicsFilters = {
        q: 'test query',
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      };

      const urlKeys: Record<keyof TopicsFilters, string> = {
        q: 'q',
        fromDate: 'fromDate',
        toDate: 'toDate',
      };

      const { result } = renderHook(() =>
        useFilters(initialValues, urlKeys, false)
      );

      expect(result.current.filters).toEqual(initialValues);
    });

    it('URLから初期化される（useUrlInit = true）', () => {
      mockLocation.search = '?q=url+query&fromDate=2024-01-01';

      const initialValues: TopicsFilters = {
        q: '',
        fromDate: '',
        toDate: '',
      };

      const urlKeys: Record<keyof TopicsFilters, string> = {
        q: 'q',
        fromDate: 'fromDate',
        toDate: 'toDate',
      };

      const { result } = renderHook(() =>
        useFilters(initialValues, urlKeys, true)
      );

      expect(result.current.filters.q).toBe('url query');
      expect(result.current.filters.fromDate).toBe('2024-01-01');
      expect(result.current.filters.toDate).toBe('');
    });

    it('URL初期化が無効の場合、初期値が維持される', () => {
      mockLocation.search = '?q=url+query';

      const initialValues: TopicsFilters = {
        q: 'initial query',
        fromDate: '',
        toDate: '',
      };

      const urlKeys: Record<keyof TopicsFilters, string> = {
        q: 'q',
        fromDate: 'fromDate',
        toDate: 'toDate',
      };

      const { result } = renderHook(() =>
        useFilters(initialValues, urlKeys, false)
      );

      expect(result.current.filters.q).toBe('initial query');
    });
  });

  describe('updateFilter', () => {
    it('単一のフィルタを更新できる', () => {
      const initialValues: TopicsFilters = {
        q: '',
        fromDate: '',
        toDate: '',
      };

      const urlKeys: Record<keyof TopicsFilters, string> = {
        q: 'q',
        fromDate: 'fromDate',
        toDate: 'toDate',
      };

      const { result } = renderHook(() =>
        useFilters(initialValues, urlKeys, false)
      );

      act(() => {
        result.current.updateFilter('q', 'new query');
      });

      expect(result.current.filters.q).toBe('new query');
      expect(result.current.filters.fromDate).toBe('');
      expect(result.current.filters.toDate).toBe('');
    });

    it('異なる型の値を更新できる', () => {
      const initialValues: AnswersFilters = {
        q: '',
        author: '',
        sortBy: 'newest',
        minScore: '',
        hasComments: false,
        fromDate: '',
        toDate: '',
      };

      const urlKeys: Record<keyof AnswersFilters, string> = {
        q: 'q',
        author: 'author',
        sortBy: 'sortBy',
        minScore: 'minScore',
        hasComments: 'hasComments',
        fromDate: 'fromDate',
        toDate: 'toDate',
      };

      const { result } = renderHook(() =>
        useFilters(initialValues, urlKeys, false)
      );

      act(() => {
        result.current.updateFilter('hasComments', true);
        result.current.updateFilter('sortBy', 'oldest');
        result.current.updateFilter('minScore', '10');
      });

      expect(result.current.filters.hasComments).toBe(true);
      expect(result.current.filters.sortBy).toBe('oldest');
      expect(result.current.filters.minScore).toBe('10');
    });
  });

  describe('resetFilters', () => {
    it('フィルタを初期値にリセットできる', () => {
      const initialValues: TopicsFilters = {
        q: 'initial',
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      };

      const urlKeys: Record<keyof TopicsFilters, string> = {
        q: 'q',
        fromDate: 'fromDate',
        toDate: 'toDate',
      };

      const { result } = renderHook(() =>
        useFilters(initialValues, urlKeys, false)
      );

      // まず値を変更
      act(() => {
        result.current.updateFilter('q', 'changed');
        result.current.updateFilter('fromDate', '2024-06-01');
      });

      expect(result.current.filters.q).toBe('changed');
      expect(result.current.filters.fromDate).toBe('2024-06-01');

      // リセット
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters).toEqual(initialValues);
    });
  });

  describe('URLパラメータの変換', () => {
    it('boolean値が正しく変換される', () => {
      mockLocation.search = '?hasComments=1';

      const initialValues: AnswersFilters = {
        q: '',
        author: '',
        sortBy: 'newest',
        minScore: '',
        hasComments: false,
        fromDate: '',
        toDate: '',
      };

      const urlKeys: Record<keyof AnswersFilters, string> = {
        q: 'q',
        author: 'author',
        sortBy: 'sortBy',
        minScore: 'minScore',
        hasComments: 'hasComments',
        fromDate: 'fromDate',
        toDate: 'toDate',
      };

      const { result } = renderHook(() =>
        useFilters(initialValues, urlKeys, true)
      );

      expect(result.current.filters.hasComments).toBe(true);
    });

    it('number値が正しく変換される', () => {
      mockLocation.search = '?minScore=15';

      const initialValues: AnswersFilters = {
        q: '',
        author: '',
        sortBy: 'newest',
        minScore: '',
        hasComments: false,
        fromDate: '',
        toDate: '',
      };

      const urlKeys: Record<keyof AnswersFilters, string> = {
        q: 'q',
        author: 'author',
        sortBy: 'sortBy',
        minScore: 'minScore',
        hasComments: 'hasComments',
        fromDate: 'fromDate',
        toDate: 'toDate',
      };

      const { result } = renderHook(() =>
        useFilters(initialValues, urlKeys, true)
      );

      expect(result.current.filters.minScore).toBe('15');
    });
  });

  describe('エラーハンドリング', () => {
    it('不正なURLパラメータがあってもクラッシュしない', () => {
      // 不正なURLパラメータ（特殊文字など）
      mockLocation.search = '?q=%E4%B8%8D%E6%AD%A3';

      const initialValues: TopicsFilters = {
        q: 'initial',
        fromDate: '',
        toDate: '',
      };

      const urlKeys: Record<keyof TopicsFilters, string> = {
        q: 'q',
        fromDate: 'fromDate',
        toDate: 'toDate',
      };

      const { result } = renderHook(() =>
        useFilters(initialValues, urlKeys, true)
      );

      // 不正なURLパラメータでもデコードされて値が設定される
      expect(result.current.filters.q).toBe('不正');
      expect(result.current.filters.fromDate).toBe('');
    });
  });
});