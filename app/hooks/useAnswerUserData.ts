/**
 * Custom hook to sync user's vote and favorite data for answers
 * This hook fetches user-specific data from the server and updates the local state
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { logger } from '~/lib/logger';

export interface AnswerUserData {
  votes: Record<number, number>; // answerId -> vote level
  favorites: Set<number>; // set of favorited answer IDs
}

/**
 * Hook to get current user ID from localStorage
 */
export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const uid = localStorage.getItem('currentSubUserId') ?? localStorage.getItem('currentUserId');
      setUserId(uid);
    } catch {
      setUserId(null);
    }
  }, []);

  return userId;
}

/**
 * Hook to fetch user's vote and favorite data for a set of answers
 */
export function useAnswerUserData(answerIds: number[], enabled: boolean = true) {
  const userId = useCurrentUserId();

  const query = useQuery({
    queryKey: ['answerUserData', userId, answerIds.sort()],
    queryFn: async (): Promise<AnswerUserData> => {
      if (!userId || answerIds.length === 0) {
        return { votes: {}, favorites: new Set() };
      }

      const params = new URLSearchParams();
      params.set('profileId', userId);
      answerIds.forEach(id => params.append('answerIds', id.toString()));

      const response = await fetch(`/api/user-data?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      return {
        votes: data.votes || {},
        favorites: new Set(data.favorites || [])
      };
    },
    enabled: enabled && !!userId && answerIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Debug logging (client-side only)
  useEffect(() => {
    if (query.isLoading) {
      logger.log('[useAnswerUserData] Fetching data for userId:', userId, 'answerIds:', answerIds);
    } else if (query.data) {
      logger.log('[useAnswerUserData] Data received:', query.data);
    }
  }, [query.isLoading, query.data, userId, answerIds]);

  return query;
}

/**
 * Hook to invalidate answer user data cache
 */
export function useInvalidateAnswerUserData() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();

  return (answerIds?: number[]) => {
    if (!userId) return;
    
    if (answerIds) {
      // Invalidate specific query
      queryClient.invalidateQueries({
        queryKey: ['answerUserData', userId, answerIds.sort()]
      });
    } else {
      // Invalidate all answerUserData queries for this user
      queryClient.invalidateQueries({
        queryKey: ['answerUserData', userId]
      });
    }
  };
}
