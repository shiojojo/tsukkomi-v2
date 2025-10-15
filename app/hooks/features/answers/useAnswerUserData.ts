import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '~/lib/logger';
import { useIdentity } from '../../common/useIdentity';
import { useQueryWithError } from '../../common/useQueryWithError';

export interface AnswerUserData {
  votes: Record<number, number>;
}

interface UseAnswerUserDataState {
  data: AnswerUserData;
  userId: string | null;
  refetch: () => Promise<void>;
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

  const query = useQueryWithError(
    ['user-data', userId || 'anonymous', normalized.key],
    async () => {
      if (!userId || !normalized.key) {
        return { votes: {} };
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
      };
    },
    {
      enabled: enabled && !!userId && !!normalized.key,
      placeholderData: { votes: {} },
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const data = useMemo(() => ({
    votes: query.data?.votes ?? {},
  }), [query.data]);

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    data,
    userId,
    refetch,
  };
}
