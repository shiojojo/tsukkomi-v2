import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '~/lib/logger';

export interface AnswerUserData {
  votes: Record<number, number>;
  favorites: Set<number>;
}

const createEmptyUserData = (): AnswerUserData => ({
  votes: {},
  favorites: new Set<number>(),
});

/**
 * Hook to get current user ID from localStorage
 */
export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const uid =
        localStorage.getItem('currentSubUserId') ??
        localStorage.getItem('currentUserId');
      setUserId(uid);
    } catch {
      setUserId(null);
    }
  }, []);

  return userId;
}

interface UseAnswerUserDataState {
  data: AnswerUserData;
  isLoading: boolean;
  error: Error | null;
  userId: string | null;
  refetch: () => Promise<void>;
  markFavorite: (answerId: number, favorited: boolean) => void;
}

/**
 * Fetches and maintains per-user answer data. Ensures network requests execute only when
 * the normalized answer id list changes or an explicit refetch is requested.
 */
export function useAnswerUserData(
  answerIds: number[],
  enabled: boolean = true
): UseAnswerUserDataState {
  const userId = useCurrentUserId();
  const normalized = useMemo(() => {
    if (!answerIds || answerIds.length === 0) {
      return { ids: [] as number[], key: '' } as const;
    }
    const unique = Array.from(new Set(answerIds.filter(id => Number.isFinite(id))));
    unique.sort((a, b) => a - b);
    return { ids: unique, key: unique.join(',') } as const;
  }, [answerIds]);

  const [data, setData] = useState<AnswerUserData>(() => createEmptyUserData());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchedKeyRef = useRef<string | null>(null);
  const normalizedIdsRef = useRef<number[]>(normalized.ids);

  useEffect(() => {
    normalizedIdsRef.current = normalized.ids;
  }, [normalized.key]);

  const fetchUserData = useCallback(
    async (force = false) => {
      if (!enabled) {
        logger.debug('[useAnswerUserData] fetch skipped: disabled');
        return;
      }
      if (!userId) {
        logger.debug('[useAnswerUserData] fetch skipped: missing userId');
        setData(createEmptyUserData());
        return;
      }
      const idsKey = normalized.key;
      const cacheKey = idsKey ? `${userId}:${idsKey}` : userId;
      if (!force && lastFetchedKeyRef.current === cacheKey) {
        logger.debug('[useAnswerUserData] fetch skipped: cache hit', cacheKey);
        return;
      }
      if (!idsKey) {
        lastFetchedKeyRef.current = cacheKey;
        setData(createEmptyUserData());
        return;
      }

      lastFetchedKeyRef.current = cacheKey;
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('profileId', userId);
        for (const id of normalizedIdsRef.current) {
          params.append('answerIds', id.toString());
        }

        logger.debug('[useAnswerUserData] fetching', params.toString());
        const response = await fetch(`/api/user-data?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch user data (status ${response.status})`);
        }

        const payload = await response.json();
        setData({
          votes: payload?.votes ?? {},
          favorites: new Set<number>((payload?.favorites ?? []).map((v: number) => Number(v))),
        });
        logger.debug('[useAnswerUserData] data received', payload);
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
  // allow future attempts by clearing cache key if fetch failed
  lastFetchedKeyRef.current = null;
        logger.error('[useAnswerUserData] fetch failed', errorObj);
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, normalized.key, userId]
  );

  useEffect(() => {
    void fetchUserData(false);
  }, [fetchUserData]);

  const refetch = useCallback(async () => {
    lastFetchedKeyRef.current = null;
    await fetchUserData(true);
  }, [fetchUserData]);

  const markFavorite = useCallback((answerId: number, favorited: boolean) => {
    setData(prev => {
      const nextFavorites = new Set<number>(prev.favorites);
      if (favorited) nextFavorites.add(answerId);
      else nextFavorites.delete(answerId);
      return {
        votes: prev.votes,
        favorites: nextFavorites,
      };
    });
  }, []);

  return {
    data,
    isLoading,
    error,
    userId,
    refetch,
    markFavorite,
  };
}
