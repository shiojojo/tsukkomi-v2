import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMutationWithError } from '~/hooks/useMutationWithError';
import { getUserFriendlyErrorMessage } from '~/lib/errors';

// Mock useToast
const mockToast = vi.fn();
vi.mock('~/hooks/useToast', () => ({
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

describe('useMutationWithError', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  describe('正常なミューテーション実行', () => {
    it('成功したミューテーションがデータを返し、成功トーストを表示する', async () => {
      const mockData = { id: 1, name: 'created' };
      const mutationFn = vi.fn().mockResolvedValue(mockData);
      const variables = { name: 'test' };

      const { result } = renderHook(
        () => useMutationWithError(mutationFn),
        { wrapper }
      );

      result.current.mutate(variables);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mutationFn).toHaveBeenCalledWith(variables);
      expect(mockToast).toHaveBeenCalledWith({
        title: '成功',
        description: '操作が完了しました',
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('401エラーの場合、ログインページにリダイレクトする', async () => {
      const errorResponse = new Response('Unauthorized', { status: 401 });
      const mutationFn = vi.fn().mockRejectedValue(errorResponse);
      const variables = { name: 'test' };

      const { result } = renderHook(
        () => useMutationWithError(mutationFn),
        { wrapper }
      );

      result.current.mutate(variables);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(mockLocation.href).toBe('/login');
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('500エラーの場合、ErrorBoundaryに委譲する', async () => {
      const errorResponse = new Response('Server Error', { status: 500 });
      const mutationFn = vi.fn().mockRejectedValue(errorResponse);
      const variables = { name: 'test' };

      const { result } = renderHook(
        () => useMutationWithError(mutationFn),
        { wrapper }
      );

      result.current.mutate(variables);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(errorResponse);
      expect(mockLocation.href).toBe('');
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('400エラーの場合、トーストを表示する', async () => {
      const errorResponse = new Response('Bad Request', { status: 400 });
      const mutationFn = vi.fn().mockRejectedValue(errorResponse);
      const variables = { name: 'test' };

      const { result } = renderHook(
        () => useMutationWithError(mutationFn),
        { wrapper }
      );

      result.current.mutate(variables);

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
      const mutationFn = vi.fn().mockRejectedValue(error);
      const variables = { name: 'test' };

      const { result } = renderHook(
        () => useMutationWithError(mutationFn),
        { wrapper }
      );

      result.current.mutate(variables);

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
    it('onSuccess オプションが正しく呼び出される', async () => {
      const mockData = { id: 1 };
      const mutationFn = vi.fn().mockResolvedValue(mockData);
      const onSuccessMock = vi.fn();
      const variables = { name: 'test' };

      const { result } = renderHook(
        () => useMutationWithError(mutationFn, { onSuccess: onSuccessMock }),
        { wrapper }
      );

      result.current.mutate(variables);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccessMock).toHaveBeenCalledWith(mockData, variables, undefined, expect.any(Object));
    });
  });
});