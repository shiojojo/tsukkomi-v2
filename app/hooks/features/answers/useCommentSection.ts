import { useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '~/hooks/common/useIdentity';
import { useOptimisticAction } from '~/hooks/common/useOptimisticAction';
import { useMutationWithError } from '~/hooks/common/useMutationWithError';
import { useQueryWithError } from '~/hooks/common/useQueryWithError';
import type { Comment } from '~/lib/schemas/comment';

export type UseCommentSectionProps = {
  answerId: number;
  initialComments: Comment[];
  actionPath?: string;
  loginRedirectPath?: string;
  onError?: (error: Error, text: string) => void;
  enabled?: boolean;
};

export function useCommentSection({
  answerId,
  initialComments,
  actionPath,
  loginRedirectPath = '/login',
  onError,
  enabled = true,
}: UseCommentSectionProps) {
  const { effectiveId } = useIdentity();
  const { fetcher, performAction } = useOptimisticAction(
    actionPath ||
      (typeof window !== 'undefined' ? window.location.pathname : '/'),
    loginRedirectPath
  );
  const queryClient = useQueryClient();

  // React Query for comments
  const commentsQuery = useQueryWithError(
    ['comments', answerId.toString()],
    async () => {
      const { getCommentsByAnswer } = await import('~/lib/db/comments');
      return await getCommentsByAnswer(answerId);
    },
    {
      placeholderData: initialComments,
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled,
    }
  );

  const comments = commentsQuery.data ?? initialComments;

  // Mutation for adding comment
  const addCommentMutation = useMutationWithError<
    void,
    { text: string },
    { previousComments: Comment[] }
  >(
    async (variables: { text: string }) => {
      return new Promise<void>((resolve, reject) => {
        performAction({
          op: 'comment',
          answerId,
          text: variables.text,
          profileId: effectiveId
        });
        // Wait for fetcher to complete with longer timeout
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max
        const checkComplete = () => {
          attempts++;
          if (fetcher.state === 'idle') {
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error('Request timeout'));
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });
    },
    {
      onMutate: async (_variables): Promise<{ previousComments: Comment[] }> => {
        // Store previous comments for rollback
        const previousComments = queryClient.getQueryData(['comments', answerId.toString()]) as Comment[];
        return { previousComments: previousComments || [] };
      },
      onSuccess: (_data, _variables, _context) => {
        console.log('[DEBUG] Comment addition successful, waiting for DB sync before refetching for answerId:', answerId);
        // Immediately update the comment count in the UI
        queryClient.setQueryData(['comments', answerId.toString()], (oldData: Comment[] | undefined) => {
          // Add a temporary comment to show immediate feedback
          const tempComment: Comment = {
            id: Date.now(), // Temporary ID
            answerId,
            text: _variables.text,
            profileId: effectiveId || '',
            created_at: new Date().toISOString(),
          };
          return [...(oldData || []), tempComment];
        });
        // Wait for DB to sync before refetching to ensure new comment is reflected
        setTimeout(() => {
          console.log('[DEBUG] DB sync wait complete, invalidating queries for answerId:', answerId);
          queryClient.invalidateQueries({ queryKey: ['comments', answerId.toString()] });
        }, 500); // Wait 500ms for DB sync
      },
      onError: (error, variables, _context) => {
        // On error, rollback to previous comments (no optimistic update, so no need to do anything)
        // Invalidate to ensure fresh data from server
        queryClient.invalidateQueries({ queryKey: ['comments', answerId.toString()] });
        // Call onError callback with the error and the text that failed to send
        onError?.(error, variables.text);
      },
    }
  );

  const handleAddComment = (text: string) => {
    addCommentMutation.mutate({ text });
  };

  return {
    comments,
    handleAddComment,
    isAddingComment: addCommentMutation.isPending,
    isLoadingComments: commentsQuery.isLoading,
    isRefetchingComments: commentsQuery.isRefetching,
  };
}
