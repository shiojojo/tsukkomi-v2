import { useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Comment } from '~/lib/schemas/comment';

interface CommentSectionProps {
  comments: Comment[];
  answerId: number;
  currentUserId: string | null;
  currentUserName: string | null;
  getNameByProfileId: (pid?: string | null) => string | undefined;
  actionPath: string;
}

export function CommentSection({
  comments,
  answerId,
  currentUserId,
  currentUserName,
  getNameByProfileId,
  actionPath,
}: CommentSectionProps) {
  const commentFetcher = useFetcher();
  const commentFormRef = useRef<HTMLFormElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (commentFetcher.state === 'idle' && commentFetcher.data) {
      commentFormRef.current?.reset();
      // Invalidate queries to refresh comments
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    }
  }, [commentFetcher.state, commentFetcher.data, queryClient]);

  return (
    <div>
      <h4 className="text-sm font-medium">コメント</h4>
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
      <div className="mt-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          コメントとして: {currentUserName ?? '名無し'}
        </div>
        <commentFetcher.Form
          method="post"
          className="flex gap-2"
          ref={commentFormRef}
          action={actionPath}
        >
          <input type="hidden" name="answerId" value={String(answerId)} />
          <input type="hidden" name="profileId" value={currentUserId ?? ''} />
          <textarea
            name="text"
            ref={commentInputRef}
            className={`form-input flex-1 min-h-[44px] resize-y p-2 rounded-md ${commentFetcher.state === 'submitting' ? 'opacity-60' : ''}`}
            placeholder="コメントを追加"
            aria-label="コメント入力"
            rows={2}
            disabled={commentFetcher.state === 'submitting'}
            onKeyDown={e => {
              const isEnter = e.key === 'Enter';
              const isMeta = e.metaKey || e.ctrlKey;
              if (isEnter && isMeta) {
                e.preventDefault();
                if (commentFormRef.current) {
                  const formData = new FormData(commentFormRef.current);
                  commentFetcher.submit(formData, {
                    method: 'post',
                    action: actionPath,
                  });
                }
              }
            }}
          />
          <button
            className={`btn-inline ${commentFetcher.state === 'submitting' ? 'opacity-60 pointer-events-none' : ''} flex items-center gap-2`}
            aria-label="コメントを送信"
            disabled={commentFetcher.state === 'submitting'}
          >
            {commentFetcher.state === 'submitting' ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
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
                送信中…
              </>
            ) : (
              '送信'
            )}
          </button>
        </commentFetcher.Form>
      </div>
    </div>
  );
}
