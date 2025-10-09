import { useEffect, useState } from 'react';
import { useIdentity } from '~/hooks/useIdentity';
import { useOptimisticAction } from '~/hooks/useOptimisticAction';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '~/components/ui/Button';

export type NumericVoteButtonsProps = {
  answerId: number;
  initialVotes: { level1: number; level2: number; level3: number };
  votesBy?: Record<string, number>;
  actionPath?: string;
  loginRedirectPath?: string;
  onSelectionChange?: (level: number | null) => void;
};
export function NumericVoteButtons({
  answerId,
  initialVotes,
  votesBy,
  actionPath,
  loginRedirectPath = '/login',
  onSelectionChange,
}: NumericVoteButtonsProps) {
  const { effectiveId } = useIdentity();
  const { fetcher, performAction } = useOptimisticAction(
    actionPath ||
      (typeof window !== 'undefined' ? window.location.pathname : '/'),
    loginRedirectPath
  );
  const queryClient = useQueryClient();

  // React Query for user vote
  const userVoteQuery = useQuery({
    queryKey: ['user-vote', answerId, effectiveId],
    queryFn: () => votesBy?.[effectiveId || ''] || null,
    placeholderData: votesBy?.[effectiveId || ''] || null,
    staleTime: Infinity, // loader dataなのでstaleにしない
  });

  // React Query for vote counts
  const voteCountsQuery = useQuery({
    queryKey: ['vote-counts', answerId],
    queryFn: () => initialVotes,
    placeholderData: initialVotes,
    staleTime: 5 * 60 * 1000,
  });

  const selection = userVoteQuery.data;
  const counts = voteCountsQuery.data || initialVotes;

  // Mutation for voting
  const voteMutation = useMutation({
    mutationFn: async ({ level }: { level: number }) => {
      return new Promise<any>((resolve, reject) => {
        performAction({ answerId, level, userId: effectiveId });
        // Wait for fetcher to complete and return response
        const checkComplete = () => {
          if (fetcher.state === 'idle') {
            if (fetcher.data) {
              resolve(fetcher.data);
            } else {
              reject(new Error('Vote failed'));
            }
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });
    },
    onSuccess: response => {
      const voteLevel = response?.answer ? response.answer.level || null : null;
      // Update user vote with server response
      queryClient.setQueryData(['user-vote', answerId, effectiveId], voteLevel);
      onSelectionChange?.(voteLevel);
      // Update vote counts with server response
      if (response?.answer?.votes) {
        queryClient.setQueryData(['vote-counts', answerId], {
          level1: response.answer.votes.level1 || 0,
          level2: response.answer.votes.level2 || 0,
          level3: response.answer.votes.level3 || 0,
        });
      }
      // Invalidate other queries
      queryClient.invalidateQueries({ queryKey: ['user-data'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['answers'], exact: false });
    },
  });

  const handleVote = (level: 1 | 2 | 3) => {
    const uid = effectiveId;
    const prev = selection;
    const isToggleOff = prev === level;

    // Optimistic update for counts
    const optimisticCounts = { ...counts };
    if (prev === 1)
      optimisticCounts.level1 = Math.max(0, optimisticCounts.level1 - 1);
    if (prev === 2)
      optimisticCounts.level2 = Math.max(0, optimisticCounts.level2 - 1);
    if (prev === 3)
      optimisticCounts.level3 = Math.max(0, optimisticCounts.level3 - 1);
    if (!isToggleOff) {
      if (level === 1)
        optimisticCounts.level1 = (optimisticCounts.level1 || 0) + 1;
      if (level === 2)
        optimisticCounts.level2 = (optimisticCounts.level2 || 0) + 1;
      if (level === 3)
        optimisticCounts.level3 = (optimisticCounts.level3 || 0) + 1;
    }
    queryClient.setQueryData(['vote-counts', answerId], optimisticCounts);

    // Optimistic update for user vote
    const newVote = isToggleOff ? null : level;
    queryClient.setQueryData(['user-vote', answerId, effectiveId], newVote);
    onSelectionChange?.(newVote);

    voteMutation.mutate({ level: isToggleOff ? 0 : level });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="control"
        active={selection === 1}
        className="gap-2 px-3"
        onClick={() => handleVote(1)}
        aria-pressed={selection === 1}
        aria-label="投票1"
        type="button"
      >
        <span>1</span>
      </Button>

      <Button
        variant="control"
        active={selection === 2}
        className="gap-2 px-3"
        onClick={() => handleVote(2)}
        aria-pressed={selection === 2}
        aria-label="投票2"
        type="button"
      >
        <span>2</span>
      </Button>

      <Button
        variant="control"
        active={selection === 3}
        className="gap-2 px-3"
        onClick={() => handleVote(3)}
        aria-pressed={selection === 3}
        aria-label="投票3"
        type="button"
      >
        <span>3</span>
      </Button>
    </div>
  );
}

export default NumericVoteButtons;
