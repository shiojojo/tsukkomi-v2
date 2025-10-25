import { useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '~/hooks/common/useIdentity';
import { useOptimisticAction } from '~/hooks/common/useOptimisticAction';
import { useMutationWithError } from '~/hooks/common/useMutationWithError';
import { useQueryWithError } from '~/hooks/common/useQueryWithError';

export type UseFavoriteButtonProps = {
  answerId: number;
  initialFavorited: boolean;
  actionPath?: string;
  loginRedirectPath?: string;
  onFavoritedChange?: (favorited: boolean) => void;
  useQuery?: boolean; // Whether to use React Query for syncing (default: true)
};

export function useFavoriteButton({
  answerId,
  initialFavorited,
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
      const { getProfileAnswerData } = await import('~/lib/db');
      const data = await getProfileAnswerData(effectiveId, [answerId]);
      return data.favorites.has(answerId);
    },
    {
      placeholderData: initialFavorited,
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: useQuery && !!effectiveId,
    }
  );

  const favorited = favoriteQuery.data ?? false;

  // Mutation for toggling favorite
  const toggleMutation = useMutationWithError<
    void,
    undefined,
    { previousFavorited: boolean | undefined }
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
      onMutate: async (): Promise<{ previousFavorited: boolean | undefined }> => {
        // Optimistic update
        const previousFavorited = queryClient.getQueryData([
          'user-favorite',
          answerId.toString(),
          effectiveId || 'anonymous',
        ]) as boolean | undefined;

        // Update favorite status
        const newFavorited = !favorited;
        queryClient.setQueryData(['user-favorite', answerId.toString(), effectiveId || 'anonymous'], newFavorited);

        onFavoritedChange?.(newFavorited);

        return { previousFavorited };
      },
      onSuccess: () => {
        // 成功時は楽観的更新を維持し、リフェッチしない
      },
      onError: (error, _, context) => {
        // On error, rollback optimistic updates
        if (context?.previousFavorited !== undefined) {
          queryClient.setQueryData(['user-favorite', answerId.toString(), effectiveId || 'anonymous'], context.previousFavorited);
        }
        queryClient.invalidateQueries({
          queryKey: ['user-favorite', answerId.toString(), effectiveId || 'anonymous'],
        });
      },
    }
  );

  const handleToggle = () => {
    toggleMutation.mutate(undefined);
  };

  return {
    favorited,
    handleToggle,
    isToggling: toggleMutation.isPending,
  };
}
