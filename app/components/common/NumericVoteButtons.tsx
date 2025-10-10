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
      return new Promise<void>((resolve, reject) => {
        performAction({ answerId, level, userId: effectiveId });
        // Wait for fetcher to complete
        const checkComplete = () => {
          if (fetcher.state === 'idle') {
            resolve();
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });
    },
    onMutate: async ({ level }) => {
      // Optimistic update
      const previousUserVote = queryClient.getQueryData([
        'user-vote',
        answerId,
        effectiveId,
      ]);
      const previousVoteCounts = queryClient.getQueryData([
        'vote-counts',
        answerId,
      ]);

      // Update user vote
      queryClient.setQueryData(['user-vote', answerId, effectiveId], level);

      // Update vote counts
      if (previousVoteCounts) {
        const newCounts = { ...previousVoteCounts } as {
          level1: number;
          level2: number;
          level3: number;
        };
        // Adjust counts based on previous vote
        const prevLevel = previousUserVote as number | null;
        if (prevLevel && prevLevel >= 1 && prevLevel <= 3) {
          newCounts[`level${prevLevel}` as keyof typeof newCounts] -= 1;
        }
        if (level >= 1 && level <= 3) {
          newCounts[`level${level}` as keyof typeof newCounts] += 1;
        }
        queryClient.setQueryData(['vote-counts', answerId], newCounts);
      }

      onSelectionChange?.(level);

      return { previousUserVote, previousVoteCounts };
    },
    onSuccess: () => {
      // Invalidate to refetch from server
      queryClient.invalidateQueries({
        queryKey: ['user-vote', answerId, effectiveId],
      });
      queryClient.invalidateQueries({ queryKey: ['vote-counts', answerId] });
      queryClient.invalidateQueries({ queryKey: ['user-data'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['answers'], exact: false });
    },
    onError: (error, { level }, context) => {
      // Rollback on error
      if (context?.previousUserVote !== undefined) {
        queryClient.setQueryData(
          ['user-vote', answerId, effectiveId],
          context.previousUserVote
        );
      }
      if (context?.previousVoteCounts) {
        queryClient.setQueryData(
          ['vote-counts', answerId],
          context.previousVoteCounts
        );
      }
      onSelectionChange?.((context?.previousUserVote as number | null) || null);
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
