import { useEffect, useRef, useState } from 'react';
import { useCommentSection } from '~/hooks/features/answers/useCommentSection';
import type { Comment } from '~/lib/schemas/comment';

interface CommentSectionProps {
  comments: Comment[];
  answerId: number;
  currentUserId: string | null;
  currentUserName: string | null;
  getNameByProfileId: (pid?: string | null) => string | undefined;
  actionPath: string;
  onCommentCountChange?: (count: number) => void;
  enabled?: boolean;
  initialCommentCount?: number;
}

export function CommentSection({
  comments: initialComments,
  answerId,
  currentUserId,
  currentUserName,
  getNameByProfileId,
  actionPath,
  onCommentCountChange,
  enabled = true,
  initialCommentCount = 0,
}: CommentSectionProps) {
  const commentFormRef = useRef<HTMLFormElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [commentText, setCommentText] = useState('');

  // Use the new hook for comment management
  const { comments, handleAddComment, isAddingComment, isRefetchingComments } =
    useCommentSection({
      answerId,
      initialComments,
      actionPath,
      onError: (error, text) => {
        // Restore the failed comment text to the textarea
        setCommentText(text);
      },
      enabled,
    });

  // Notify parent of comment count changes
  // Only update if the actual comment count is greater than the initial count from answer_search_view
  // This prevents flickering from 0 when lazy loading comments
  useEffect(() => {
    if (comments.length > initialCommentCount) {
      onCommentCountChange?.(comments.length);
    }
  }, [comments.length, initialCommentCount, onCommentCountChange]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const text = String(formData.get('text') || '').trim();
    if (text) {
      handleAddComment(text);
      commentFormRef.current?.reset();
      setCommentText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isEnter = e.key === 'Enter';
    const isMeta = e.metaKey || e.ctrlKey;
    if (isEnter && isMeta) {
      e.preventDefault();
      const form = commentFormRef.current;
      if (form) {
        const formData = new FormData(form);
        const text = String(formData.get('text') || '').trim();
        if (text) {
          handleAddComment(text);
          form.reset();
          setCommentText('');
        }
      }
    }
  };

  return (
    <div>
      <h4 className="text-sm font-medium">
        コメント
        {isRefetchingComments && (
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
      <div className="mt-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          コメントとして: {currentUserName ?? '名無し'}
        </div>
        <form
          method="post"
          className="flex gap-2"
          ref={commentFormRef}
          action={actionPath}
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="answerId" value={String(answerId)} />
          <input type="hidden" name="profileId" value={currentUserId ?? ''} />
          <textarea
            name="text"
            ref={commentInputRef}
            className={`form-input flex-1 min-h-[44px] resize-y p-2 rounded-md ${isAddingComment ? 'opacity-60' : ''}`}
            placeholder="コメントを追加"
            aria-label="コメント入力"
            rows={2}
            maxLength={500}
            value={commentText}
            disabled={isAddingComment}
            onChange={e => setCommentText(e.target.value.slice(0, 500))}
            onPaste={e => {
              const pastedText = e.clipboardData.getData('text');
              const newText = (commentText + pastedText).slice(0, 500);
              setCommentText(newText);
              e.preventDefault();
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {commentText.length}/500
          </div>
          <button
            className={`btn-inline ${isAddingComment ? 'opacity-60 pointer-events-none' : ''} flex items-center gap-2`}
            aria-label="コメントを送信"
            disabled={isAddingComment}
            type="submit"
          >
            {isAddingComment ? (
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
        </form>
      </div>
    </div>
  );
}
