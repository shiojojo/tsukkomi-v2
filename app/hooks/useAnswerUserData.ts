/**
 * Custom hook to sync user's vote and favorite data for answers
 * This hook fetches user-specific data from the server and updates the local state
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

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

  return useQuery({
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
}
