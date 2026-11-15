import { useQueryWithError } from '~/hooks/common/useQueryWithError';
import type { Comment } from '~/lib/schemas/comment';

interface CommentSectionProps {
  comments: Comment[];
  answerId: number;
  getNameByProfileId: (pid?: string | null) => string | undefined;
  enabled?: boolean;
}

export function CommentSection({
  comments: initialComments,
  answerId,
  getNameByProfileId,
  enabled = true,
}: CommentSectionProps) {
  const commentsQuery = useQueryWithError(
    ['comments', String(answerId)],
    async () => {
      const { getCommentsByAnswer } = await import('~/lib/db/comments');
      return getCommentsByAnswer(answerId);
    },
    {
      placeholderData: initialComments,
      staleTime: 5 * 60 * 1000,
      enabled,
    },
  );
  const comments = commentsQuery.data ?? initialComments;

  return (
    <div>
      <h4 className="text-sm font-medium">
        コメント
        {commentsQuery.isRefetching && (
          <span className="ml-2 text-xs text-gray-400">
            <svg
              className="inline animate-spin h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}
      </h4>
      <ul className="mt-2 space-y-2 text-sm">
        {comments.map(comment => (
          <li key={comment.id} className="text-gray-700 dark:text-gray-100">
            <div className="whitespace-pre-wrap">{comment.text}</div>{' '}
            <span className="text-xs text-gray-400 dark:text-gray-400">
              — {getNameByProfileId(comment.profileId) ?? '名無し'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
