/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAnswerUserData } from '~/hooks/features/answers/useAnswerUserData';
import { useIdentity } from '~/hooks/common/useIdentity';
import { useQueryWithError } from '~/hooks/common/useQueryWithError';

// Mock dependencies
vi.mock('~/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

vi.mock('~/hooks/common/useIdentity', () => ({
  useIdentity: vi.fn(),
}));

vi.mock('~/hooks/common/useQueryWithError', () => ({
  useQueryWithError: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useAnswerUserData', () => {
  let queryClient: QueryClient;
  let mockUseIdentity: any;
  let mockUseQueryWithError: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    mockUseIdentity = vi.mocked(useIdentity);
    mockUseQueryWithError = vi.mocked(useQueryWithError);

    // Reset mocks
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  describe('when user is not logged in', () => {
    it('should return empty votes when userId is null', async () => {
      mockUseIdentity.mockReturnValue({ effectiveId: null });

      mockUseQueryWithError.mockReturnValue({
        data: { votes: {} },
        refetch: vi.fn(),
      });

      const { result } = renderHook(
        () => useAnswerUserData([1, 2, 3]),
        { wrapper }
      );

      expect(result.current.userId).toBeNull();
      expect(result.current.data.votes).toEqual({});
    });

    it('should not make API call when userId is null', () => {
      mockUseIdentity.mockReturnValue({ effectiveId: null });

      mockUseQueryWithError.mockReturnValue({
        data: { votes: {} },
        refetch: vi.fn(),
      });

      renderHook(() => useAnswerUserData([1, 2, 3]), { wrapper });

      expect(mockUseQueryWithError).toHaveBeenCalledWith(
        ['user-data', 'anonymous', '1,2,3'],
        expect.any(Function),
        expect.objectContaining({
          enabled: false, // enabled should be false when userId is null
          placeholderData: { votes: {} },
          staleTime: 5 * 60 * 1000,
        })
      );
    });
  });

  describe('when user is logged in', () => {
    const userId = 'user123';

    beforeEach(() => {
      mockUseIdentity.mockReturnValue({ effectiveId: userId });
    });

    it('should normalize answerIds (remove duplicates and sort)', () => {
      mockUseQueryWithError.mockReturnValue({
        data: { votes: {} },
        refetch: vi.fn(),
      });

      renderHook(() => useAnswerUserData([3, 1, 2, 1, 3]), { wrapper });

      expect(mockUseQueryWithError).toHaveBeenCalledWith(
        ['user-data', userId, '1,2,3'],
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should filter out invalid answerIds', () => {
      mockUseQueryWithError.mockReturnValue({
        data: { votes: {} },
        refetch: vi.fn(),
      });

      renderHook(() => useAnswerUserData([1, NaN, 2, Infinity, 3]), { wrapper });

      expect(mockUseQueryWithError).toHaveBeenCalledWith(
        ['user-data', userId, '1,2,3'],
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should handle empty answerIds array', () => {
      mockUseQueryWithError.mockReturnValue({
        data: { votes: {} },
        refetch: vi.fn(),
      });

      renderHook(() => useAnswerUserData([]), { wrapper });

      expect(mockUseQueryWithError).toHaveBeenCalledWith(
        ['user-data', userId, ''],
        expect.any(Function),
        expect.objectContaining({
          enabled: false, // enabled should be false when normalized.key is empty
        })
      );
    });

    it('should make correct API call with proper parameters', async () => {
      const mockResponse = {
        votes: { 1: 2, 2: -1, 3: 1 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      let queryFn: any;
      mockUseQueryWithError.mockImplementation((_key: any, fn: any, _options: any) => {
        queryFn = fn;
        return {
          data: mockResponse,
          refetch: vi.fn(),
        };
      });

      renderHook(() => useAnswerUserData([1, 2, 3]), { wrapper });

      // Execute the query function
      const result = await queryFn();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user-data?profileId=user123&answerIds=1&answerIds=2&answerIds=3'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      let queryFn: any;
      mockUseQueryWithError.mockImplementation((_key: any, fn: any) => {
        queryFn = fn;
        return {
          data: { votes: {} },
          refetch: vi.fn(),
        };
      });

      renderHook(() => useAnswerUserData([1, 2, 3]), { wrapper });

      await expect(queryFn()).rejects.toThrow(
        'Failed to fetch user data (status 500)'
      );
    });

    it('should handle malformed API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null), // null response
      });

      let queryFn: any;
      mockUseQueryWithError.mockImplementation((_key: any, fn: any) => {
        queryFn = fn;
        return {
          data: { votes: {} },
          refetch: vi.fn(),
        };
      });

      renderHook(() => useAnswerUserData([1, 2, 3]), { wrapper });

      const result = await queryFn();
      expect(result).toEqual({ votes: {} }); // Should default to empty object
    });

    it('should return correct data structure', () => {
      const mockData = { votes: { 1: 2, 2: -1 } };
      mockUseQueryWithError.mockReturnValue({
        data: mockData,
        refetch: vi.fn(),
      });

      const { result } = renderHook(
        () => useAnswerUserData([1, 2]),
        { wrapper }
      );

      expect(result.current.data).toEqual(mockData);
      expect(result.current.userId).toBe(userId);
    });

    it('should provide refetch function', () => {
      const mockRefetch = vi.fn();
      mockUseQueryWithError.mockReturnValue({
        data: { votes: {} },
        refetch: mockRefetch,
      });

      const { result } = renderHook(
        () => useAnswerUserData([1, 2]),
        { wrapper }
      );

      result.current.refetch();
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should disable query when enabled is false', () => {
      mockUseQueryWithError.mockReturnValue({
        data: { votes: {} },
        refetch: vi.fn(),
      });

      renderHook(() => useAnswerUserData([1, 2], false), { wrapper });

      expect(mockUseQueryWithError).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Function),
        expect.objectContaining({
          enabled: false,
        })
      );
    });

    it('should handle undefined answerIds', () => {
      mockUseQueryWithError.mockReturnValue({
        data: { votes: {} },
        refetch: vi.fn(),
      });

      renderHook(() => useAnswerUserData(undefined as any), { wrapper });

      expect(mockUseQueryWithError).toHaveBeenCalledWith(
        ['user-data', userId, ''],
        expect.any(Function),
        expect.objectContaining({
          enabled: false,
        })
      );
    });
  });

  describe('query configuration', () => {
    it('should have correct query options', () => {
      mockUseIdentity.mockReturnValue({ effectiveId: 'user123' });
      mockUseQueryWithError.mockReturnValue({
        data: { votes: {} },
        refetch: vi.fn(),
      });

      renderHook(() => useAnswerUserData([1, 2, 3]), { wrapper });

      expect(mockUseQueryWithError).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Function),
        {
          enabled: true,
          placeholderData: { votes: {} },
          staleTime: 5 * 60 * 1000, // 5 minutes
        }
      );
    });
  });
});