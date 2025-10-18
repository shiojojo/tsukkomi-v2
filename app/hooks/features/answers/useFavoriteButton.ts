import { useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '~/hooks/common/useIdentity';
import { useOptimisticAction } from '~/hooks/common/useOptimisticAction';
import { useMutationWithError } from '~/hooks/common/useMutationWithError';
import { useQueryWithError } from '~/hooks/common/useQueryWithError';

export type UseFavoriteButtonProps = {
  answerId: number;
  initialFavorited: boolean;
  initialCount: number;
  actionPath?: string;
  loginRedirectPath?: string;
  onFavoritedChange?: (favorited: boolean) => void;
  useQuery?: boolean; // Whether to use React Query for syncing (default: true)
};

export function useFavoriteButton({
  answerId,
  initialFavorited,
  initialCount,
  actionPath,
  loginRedirectPath = '/login',
  onFavoritedChange,
  useQuery = true,
}: UseFavoriteButtonProps) {
  const { effectiveId } = useIdentity();
  const { fetcher, performAction } = useOptimisticAction(
    actionPath ||
      (typeof window !== 'undefined' ? window.location.pathname : '/'),
    loginRedirectPath
  );
  const queryClient = useQueryClient();

  // React Query for user favorite status
  const favoriteQuery = useQueryWithError(
    ['user-favorite', answerId.toString(), effectiveId || 'anonymous'],
    async () => {
      if (!effectiveId) return false;
      const params = new URLSearchParams();
      params.set('profileId', effectiveId);
      params.append('answerIds', answerId.toString());
      const response = await fetch(`/api/user-data?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch user data (status ${response.status})`);
      }
      const payload = await response.json();
      return (payload?.favorites ?? []).includes(answerId);
    },
    {
      placeholderData: initialFavorited,
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: useQuery && !!effectiveId,
    }
  );

  // React Query for favorite count
  const countQuery = useQueryWithError(
    ['favorite-count', answerId.toString()],
    async () => initialCount,
    {
      placeholderData: initialCount,
      staleTime: 5 * 60 * 1000,
    }
  );

  const favorited = favoriteQuery.data ?? false;
  const count = countQuery.data ?? initialCount;

  // Mutation for toggling favorite
  const toggleMutation = useMutationWithError<
    void,
    undefined,
    { previousFavorited: boolean | undefined; previousCount: number }
  >(
    async () => {
      return new Promise<void>((resolve) => {
        performAction({ op: 'toggle', answerId, profileId: effectiveId });
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
      onMutate: async (): Promise<{ previousFavorited: boolean | undefined; previousCount: number }> => {
        // Optimistic update
        const previousFavorited = queryClient.getQueryData([
          'user-favorite',
          answerId.toString(),
          effectiveId || 'anonymous',
        ]) as boolean | undefined;
        const previousCount = queryClient.getQueryData([
          'favorite-count',
          answerId.toString(),
        ]) as number;

        // Update favorite status
        const newFavorited = !favorited;
        queryClient.setQueryData(['user-favorite', answerId.toString(), effectiveId || 'anonymous'], newFavorited);

        // Update favorite count
        const newCount = newFavorited ? count + 1 : count - 1;
        queryClient.setQueryData(['favorite-count', answerId.toString()], newCount);

        onFavoritedChange?.(newFavorited);

        return { previousFavorited, previousCount };
      },
      onSuccess: () => {
        // 成功時は楽観的更新を維持し、リフェッチしない
      },
      onError: (error, _, context) => {
        // On error, rollback optimistic updates
        if (context?.previousFavorited !== undefined) {
          queryClient.setQueryData(['user-favorite', answerId.toString(), effectiveId || 'anonymous'], context.previousFavorited);
        }
        if (context?.previousCount !== undefined) {
          queryClient.setQueryData(['favorite-count', answerId.toString()], context.previousCount);
        }
        queryClient.invalidateQueries({
          queryKey: ['user-favorite', answerId.toString(), effectiveId || 'anonymous'],
        });
        queryClient.invalidateQueries({ queryKey: ['favorite-count', answerId.toString()] });
      },
    }
  );

  const handleToggle = () => {
    toggleMutation.mutate(undefined);
  };

  return {
    favorited,
    count,
    handleToggle,
    isToggling: toggleMutation.isPending,
  };
}
