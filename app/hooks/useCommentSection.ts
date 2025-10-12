import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdentity } from '~/hooks/useIdentity';
import { useOptimisticAction } from '~/hooks/useOptimisticAction';
import { useMutationWithError } from '~/hooks/useMutationWithError';
import type { Comment } from '~/lib/schemas/comment';

export type UseCommentSectionProps = {
  answerId: number;
  initialComments: Comment[];
  actionPath?: string;
  loginRedirectPath?: string;
  onError?: (error: Error, text: string) => void;
};

export function useCommentSection({
  answerId,
  initialComments,
  actionPath,
  loginRedirectPath = '/login',
  onError,
}: UseCommentSectionProps) {
  const { effectiveId } = useIdentity();
  const { fetcher, performAction } = useOptimisticAction(
    actionPath ||
      (typeof window !== 'undefined' ? window.location.pathname : '/'),
    loginRedirectPath
  );
  const queryClient = useQueryClient();

  // React Query for comments
  const commentsQuery = useQuery({
    queryKey: ['comments', answerId],
    queryFn: async () => {
      console.log('[DEBUG] Fetching comments for answerId:', answerId);
      const { getCommentsByAnswer } = await import('~/lib/db/comments');
      const result = await getCommentsByAnswer(answerId);
      console.log('[DEBUG] Fetched comments for answerId:', answerId, 'count:', result.length);
      return result;
    },
    placeholderData: initialComments,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const comments = commentsQuery.data ?? initialComments;

  // Mutation for adding comment
  const addCommentMutation = useMutationWithError<
    void,
    { text: string },
    { previousComments: Comment[] }
  >(
    async (variables: { text: string }) => {
      console.log('[DEBUG] Starting comment addition for answerId:', answerId, 'text:', variables.text);
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
          console.log(`[DEBUG] Checking fetcher state, attempt ${attempts}/${maxAttempts}, state:`, fetcher.state);
          if (fetcher.state === 'idle') {
            console.log('[DEBUG] Fetcher completed, resolving mutation');
            resolve();
          } else if (attempts >= maxAttempts) {
            console.log('[DEBUG] Request timeout after', maxAttempts, 'attempts');
            reject(new Error('Request timeout'));
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });
    },
    {
      onMutate: async (variables): Promise<{ previousComments: Comment[] }> => {
        // Store previous comments for rollback
        const previousComments = queryClient.getQueryData(['comments', answerId]) as Comment[];
        return { previousComments: previousComments || [] };
      },
      onSuccess: (data, variables, context) => {
        console.log('[DEBUG] Comment addition successful, waiting for DB sync before refetching for answerId:', answerId);
        // Wait for DB to sync before refetching to ensure new comment is reflected
        setTimeout(() => {
          console.log('[DEBUG] DB sync wait complete, invalidating queries for answerId:', answerId);
          queryClient.invalidateQueries({ queryKey: ['comments', answerId] });
        }, 500); // Wait 500ms for DB sync
      },
      onError: (error, variables, context) => {
        console.log('[DEBUG] Comment addition failed for answerId:', answerId, 'error:', error);
        // On error, rollback to previous comments (no optimistic update, so no need to do anything)
        // Invalidate to ensure fresh data from server
        queryClient.invalidateQueries({ queryKey: ['comments', answerId] });
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
