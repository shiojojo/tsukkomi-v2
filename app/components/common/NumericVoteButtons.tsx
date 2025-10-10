import { useEffect, useState } from 'react';
import { useIdentity } from '~/hooks/useIdentity';
import { useOptimisticAction } from '~/hooks/useOptimisticAction';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useMutationWithError } from '~/hooks/useMutationWithError';
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
  const voteMutation = useMutationWithError(
    async ({ level }: { level: number }) => {
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
    {
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
        const newVote = level === 0 ? null : level;
        queryClient.setQueryData(['user-vote', answerId, effectiveId], newVote);

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
          if (newVote && newVote >= 1 && newVote <= 3) {
            newCounts[`level${newVote}` as keyof typeof newCounts] += 1;
          }
          queryClient.setQueryData(['vote-counts', answerId], newCounts);
        }

        onSelectionChange?.(newVote);

        return { previousUserVote, previousVoteCounts };
      },
      onSuccess: () => {
        // 成功時は楽観的更新を維持し、リフェッチしない
      },
      onError: (error, { level }, context) => {
        // On error, invalidate to refetch from server
        queryClient.invalidateQueries({
          queryKey: ['user-vote', answerId, effectiveId],
        });
        queryClient.invalidateQueries({ queryKey: ['vote-counts', answerId] });
      },
    }
  );

  const handleVote = (level: 1 | 2 | 3) => {
    const isToggleOff = selection === level;
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
