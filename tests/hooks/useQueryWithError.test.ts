import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useQueryWithError } from '~/hooks/common/useQueryWithError';
import { getUserFriendlyErrorMessage } from '~/lib/errors';

// Mock useToast
const mockToast = vi.fn();
vi.mock('~/hooks/common/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock getUserFriendlyErrorMessage
vi.mock('~/lib/errors', () => ({
  getUserFriendlyErrorMessage: vi.fn(() => 'Mock error message'),
}));

// Mock window.location
const mockLocation = { href: '' };
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('useQueryWithError', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  describe('正常なクエリ実行', () => {
    it('成功したクエリがデータを返す', async () => {
      const mockData = { id: 1, name: 'test' };
      const queryFn = vi.fn().mockResolvedValue(mockData);

      const { result } = renderHook(
        () => useQueryWithError(['test'], queryFn),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('エラーハンドリング', () => {
    it('401エラーの場合、ログインページにリダイレクトする', async () => {
      const errorResponse = new Response('Unauthorized', { status: 401 });
      const queryFn = vi.fn().mockRejectedValue(errorResponse);

      const { result } = renderHook(
        () => useQueryWithError(['test'], queryFn),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockLocation.href).toBe('/login');
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('500エラーの場合、ErrorBoundaryに委譲する', async () => {
      const errorResponse = new Response('Server Error', { status: 500 });
      const queryFn = vi.fn().mockRejectedValue(errorResponse);

      const { result } = renderHook(
        () => useQueryWithError(['test'], queryFn),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(errorResponse);
      expect(mockLocation.href).toBe('');
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('400エラーの場合、トーストを表示する', async () => {
      const errorResponse = new Response('Bad Request', { status: 400 });
      const queryFn = vi.fn().mockRejectedValue(errorResponse);

      const { result } = renderHook(
        () => useQueryWithError(['test'], queryFn),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'エラー',
        description: 'Mock error message',
        variant: 'destructive',
      });
      expect(getUserFriendlyErrorMessage).toHaveBeenCalledWith(errorResponse);
    });

    it('一般的なエラーの場合、トーストを表示する', async () => {
      const error = new Error('Network error');
      const queryFn = vi.fn().mockRejectedValue(error);

      const { result } = renderHook(
        () => useQueryWithError(['test'], queryFn),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'エラー',
        description: 'Mock error message',
        variant: 'destructive',
      });
      expect(getUserFriendlyErrorMessage).toHaveBeenCalledWith(error);
    });
  });

  describe('オプションの引き継ぎ', () => {
    it('useQueryOptions が正しく引き継がれる', async () => {
      const mockData = { id: 1 };
      const queryFn = vi.fn().mockResolvedValue(mockData);
      const options = {
        enabled: false,
        staleTime: 1000,
      };

      const { result } = renderHook(
        () => useQueryWithError(['test'], queryFn, options),
        { wrapper }
      );

      expect(result.current.isFetching).toBe(false); // enabled: false なので
    });
  });
});