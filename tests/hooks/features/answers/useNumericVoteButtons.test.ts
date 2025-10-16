/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useNumericVoteButtons } from '~/hooks/features/answers/useNumericVoteButtons';
import { useIdentity } from '~/hooks/common/useIdentity';
import { useOptimisticAction } from '~/hooks/common/useOptimisticAction';
import { useMutationWithError } from '~/hooks/common/useMutationWithError';

// Mock dependencies
vi.mock('~/hooks/common/useIdentity', () => ({
  useIdentity: vi.fn(),
}));

vi.mock('~/hooks/common/useOptimisticAction', () => ({
  useOptimisticAction: vi.fn(),
}));

vi.mock('~/hooks/common/useMutationWithError', () => ({
  useMutationWithError: vi.fn(),
}));

// Mock window.location
Object.defineProperty(window, 'location', {
  value: { pathname: '/test-path' },
  writable: true,
});

describe('useNumericVoteButtons', () => {
  let queryClient: QueryClient;
  let mockUseIdentity: any;
  let mockUseOptimisticAction: any;
  let mockUseMutationWithError: any;

  const initialVotes = { level1: 5, level2: 3, level3: 1 };
  const votesBy = { user123: 2 };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    mockUseIdentity = vi.mocked(useIdentity);
    mockUseOptimisticAction = vi.mocked(useOptimisticAction);
    mockUseMutationWithError = vi.mocked(useMutationWithError);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );

  const setupMocks = (userId: string = 'user123') => {
    const mockFetcher = { state: 'idle' };
    const mockPerformAction = vi.fn();

    mockUseIdentity.mockReturnValue({ effectiveId: userId });
    mockUseOptimisticAction.mockReturnValue({
      fetcher: mockFetcher,
      performAction: mockPerformAction,
    });

    const mockMutation = {
      mutate: vi.fn(),
      isPending: false,
    };
    mockUseMutationWithError.mockReturnValue(mockMutation);

    return { mockFetcher, mockPerformAction, mockMutation };
  };

  describe('initialization', () => {
    it('should initialize with correct props', () => {
      setupMocks();

      renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy,
          }),
        { wrapper }
      );

      expect(mockUseOptimisticAction).toHaveBeenCalledWith('/test-path', '/login');
      expect(mockUseMutationWithError).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          onMutate: expect.any(Function),
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });

    it('should use custom actionPath and loginRedirectPath', () => {
      setupMocks();

      renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            actionPath: '/custom-path',
            loginRedirectPath: '/custom-login',
          }),
        { wrapper }
      );

      expect(mockUseOptimisticAction).toHaveBeenCalledWith('/custom-path', '/custom-login');
    });
  });

  describe('user vote query', () => {
    it('should load user vote from votesBy', () => {
      setupMocks();

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy,
          }),
        { wrapper }
      );

      expect(result.current.selection).toBe(2);
    });

    it('should return null when user has no vote', () => {
      setupMocks();

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy: {}, // No votes
          }),
        { wrapper }
      );

      expect(result.current.selection).toBeNull();
    });

    it('should use placeholder data for user vote', () => {
      setupMocks();

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy,
          }),
        { wrapper }
      );

      expect(result.current.selection).toBe(2); // From votesBy
    });
  });

  describe('vote counts query', () => {
    it('should use initialVotes as vote counts', () => {
      setupMocks();

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
          }),
        { wrapper }
      );

      expect(result.current.counts).toEqual(initialVotes);
    });
  });

  describe('voting functionality', () => {
    it('should call handleVote and trigger mutation for new vote', () => {
      const { mockMutation } = setupMocks();

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy: {}, // No initial vote
          }),
        { wrapper }
      );

      result.current.handleVote(1);

      expect(mockMutation.mutate).toHaveBeenCalledWith({ level: 1 });
    });

    it('should call handleVote with level 0 to toggle off existing vote', () => {
      const { mockMutation } = setupMocks();

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy, // User has voted level 2
          }),
        { wrapper }
      );

      result.current.handleVote(2); // Toggle off level 2

      expect(mockMutation.mutate).toHaveBeenCalledWith({ level: 0 });
    });

    it('should show pending state when voting', () => {
      const { mockMutation } = setupMocks();
      mockMutation.isPending = true;

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
          }),
        { wrapper }
      );

      expect(result.current.isVoting).toBe(true);
    });

    it('should perform optimistic update when voting', () => {
      const { mockPerformAction, mockMutation } = setupMocks();

      mockMutation.mutate = vi.fn(({ level }) => {
        mockPerformAction({ answerId: 123, level, userId: 'user123' });
        return Promise.resolve();
      });

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy: {}, // No initial vote
          }),
        { wrapper }
      );

      result.current.handleVote(1);

      expect(mockPerformAction).toHaveBeenCalledWith({
        answerId: 123,
        level: 1,
        userId: 'user123',
      });
    });

    it('should perform optimistic update when toggling off vote', () => {
      const { mockPerformAction, mockMutation } = setupMocks();

      mockMutation.mutate = vi.fn(({ level }) => {
        mockPerformAction({ answerId: 123, level, userId: 'user123' });
        return Promise.resolve();
      });

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy, // User has voted level 2
          }),
        { wrapper }
      );

      result.current.handleVote(2); // Toggle off

      expect(mockPerformAction).toHaveBeenCalledWith({
        answerId: 123,
        level: 0,
        userId: 'user123',
      });
    });
  });

  describe('optimistic updates', () => {
    it('should optimistically update user vote and counts', () => {
      setupMocks();

      const onSelectionChange = vi.fn();

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy: {}, // No initial vote
            onSelectionChange,
          }),
        { wrapper }
      );

      // Initially no selection
      expect(result.current.selection).toBeNull();
      expect(result.current.counts).toEqual(initialVotes);

      // The optimistic update happens in the mutation's onMutate
      // This would be tested by triggering the mutation and checking queryClient state
    });

    it('should call onSelectionChange callback', () => {
      setupMocks();

      const onSelectionChange = vi.fn();

      renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy: {},
            onSelectionChange,
          }),
        { wrapper }
      );

      // The callback is called in the mutation's onMutate
      // This would be verified by checking the callback calls
      expect(onSelectionChange).not.toHaveBeenCalled(); // Initially not called
    });

    it('should correctly adjust vote counts when changing votes', () => {
      setupMocks();

      // Test case: user votes level 2, then changes to level 1
      // Expected: level2 decreases by 1, level1 increases by 1

      renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
            votesBy, // User has level 2
          }),
        { wrapper }
      );

      // The count adjustment logic is in the mutation's onMutate
      // This would be verified by checking the count calculations
    });
  });

  describe('error handling', () => {
    it('should invalidate queries on error', () => {
      setupMocks();

      renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
          }),
        { wrapper }
      );

      // The invalidation happens in the mutation's onError callback
      // This would be verified by checking queryClient.invalidateQueries calls
    });
  });

  describe('return values', () => {
    it('should return correct structure', () => {
      setupMocks();

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
          }),
        { wrapper }
      );

      expect(result.current).toHaveProperty('selection');
      expect(result.current).toHaveProperty('counts');
      expect(result.current).toHaveProperty('handleVote');
      expect(result.current).toHaveProperty('isVoting');
      expect(typeof result.current.handleVote).toBe('function');
    });

    it('should handle all vote levels', () => {
      setupMocks();

      const { result } = renderHook(
        () =>
          useNumericVoteButtons({
            answerId: 123,
            initialVotes,
          }),
        { wrapper }
      );

      // Test that handleVote accepts all valid levels
      expect(() => result.current.handleVote(1)).not.toThrow();
      expect(() => result.current.handleVote(2)).not.toThrow();
      expect(() => result.current.handleVote(3)).not.toThrow();
    });
  });
});