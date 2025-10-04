import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '~/lib/logger';
import { useIdentity } from './useIdentity';

export interface AnswerUserData {
  votes: Record<number, number>;
  favorites: Set<number>;
}

interface UseAnswerUserDataState {
  data: AnswerUserData;
  userId: string | null;
  refetch: () => Promise<void>;
  markFavorite: (answerId: number, favorited: boolean) => void;
}

/**
 * Fetches and maintains per-user answer data using TanStack Query.
 * Ensures network requests execute only when the normalized answer id list changes.
 */
export function useAnswerUserData(
  answerIds: number[],
  enabled: boolean = true
): UseAnswerUserDataState {
  const { effectiveId } = useIdentity();
  const userId = effectiveId;
  const normalized = useMemo(() => {
    if (!answerIds || answerIds.length === 0) {
      return { ids: [] as number[], key: '' } as const;
    }
    const unique = Array.from(new Set(answerIds.filter(id => Number.isFinite(id))));
    unique.sort((a, b) => a - b);
    return { ids: unique, key: unique.join(',') } as const;
  }, [answerIds]);

  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['user-data', userId, normalized.key],
    queryFn: async () => {
      if (!userId || !normalized.key) {
        return { votes: {}, favorites: [] };
      }
      const params = new URLSearchParams();
      params.set('profileId', userId);
      for (const id of normalized.ids) {
        params.append('answerIds', id.toString());
      }
      logger.debug('[useAnswerUserData] fetching', params.toString());
      const response = await fetch(`/api/user-data?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch user data (status ${response.status})`);
      }
      const payload = await response.json();
      return {
        votes: payload?.votes ?? {},
        favorites: (payload?.favorites ?? []).map((v: number) => Number(v)),
      };
    },
    enabled: enabled && !!userId && !!normalized.key,
    initialData: { votes: {}, favorites: [] },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const data = useMemo(() => ({
    votes: query.data?.votes ?? {},
    favorites: new Set<number>(query.data?.favorites ?? []),
  }), [query.data]);

  const markFavorite = useCallback((answerId: number, favorited: boolean) => {
    // Optimistic update
    queryClient.setQueryData(['user-data', userId, normalized.key], (old: any) => {
      if (!old) return old;
      const nextFavorites = [...old.favorites];
      if (favorited) {
        if (!nextFavorites.includes(answerId)) nextFavorites.push(answerId);
      } else {
        const idx = nextFavorites.indexOf(answerId);
        if (idx >= 0) nextFavorites.splice(idx, 1);
      }
      return { ...old, favorites: nextFavorites };
    });
  }, [queryClient, userId, normalized.key]);

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    data,
    userId,
    refetch,
    markFavorite,
  };
}
