import { useEffect, useMemo, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import FavoriteButton from '~/components/FavoriteButton';
import NumericVoteButtons from '~/components/NumericVoteButtons';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';

export type AnswerActionCardProps = {
  answer: Answer;
  topic: Topic | null;
  comments: Comment[];
  currentUserId: string | null;
  currentUserName: string | null;
  getNameByProfileId: (pid?: string | null) => string | undefined;
  userAnswerData: { votes: Record<number, number>; favorites: Set<number> };
  onFavoriteUpdate?: (answerId: number, favorited: boolean) => void;
  actionPath: string;
  profileIdForVotes?: string | null;
};

/**
 * 概要: お題情報付きの回答カード。お気に入り・採点・コメント送信を 1 カードに集約して表示する。
 * Intent: /answers, /answers/favorites, /topics/:id など複数スクリーンで UI を統一し再利用する。
 * Contract:
 *   - props.answer は votes(level1..3) / favorited を含む場合がある。なければ 0 扱い。
 *   - props.userAnswerData は useAnswerUserData などで取得したローカル同期情報。
 *   - actionPath に対して POST (toggle/vote/comment) を行う。ルート側に同じ action を実装しておくこと。
 * Environment:
 *   - ブラウザ専用。localStorage や fetcher を利用するため SSR では副作用を起こさないよう条件分岐済み。
 * Errors:
 *   - fetcher 経由の失敗は UI 上は静かにしつつ console へログ。致命的であればルート側 action が 4xx/5xx を返す。
 */
export function AnswerActionCard({
  answer,
  topic,
  comments,
  currentUserId,
  currentUserName,
  getNameByProfileId,
  userAnswerData,
  onFavoriteUpdate,
  actionPath,
  profileIdForVotes,
}: AnswerActionCardProps) {
  const [open, setOpen] = useState(false);
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

  const score = useMemo(() => {
    const votes = (answer as any).votes || {
      level1: 0,
      level2: 0,
      level3: 0,
    };
    return (
      Number(votes.level1 || 0) * 1 +
      Number(votes.level2 || 0) * 2 +
      Number(votes.level3 || 0) * 3
    );
  }, [answer]);

  const votesCounts = useMemo(() => {
    const votes = (answer as any).votes || {
      level1: 0,
      level2: 0,
      level3: 0,
    };
    return {
      level1: Number(votes.level1 || 0),
      level2: Number(votes.level2 || 0),
      level3: Number(votes.level3 || 0),
    };
  }, [answer]);

  const profileForVote = profileIdForVotes ?? currentUserId ?? null;
  const votesBy = useMemo(() => {
    if (profileForVote && userAnswerData.votes[answer.id]) {
      return { [profileForVote]: userAnswerData.votes[answer.id] };
    }
    const embedded = (answer as any).votesBy as
      | Record<string, number>
      | undefined;
    return embedded && Object.keys(embedded).length ? embedded : undefined;
  }, [answer, profileForVote, userAnswerData.votes]);

  const initialFavorited = useMemo(() => {
    if (userAnswerData.favorites.has(answer.id)) return true;
    return Boolean((answer as any).favorited);
  }, [answer, userAnswerData.favorites]);

  return (
    <li className="p-4 border rounded-md bg-white/80 dark:bg-gray-950/80">
      <div className="flex flex-col gap-4">
        <div>
          {topic ? (
            topic.image ? (
              <div className="block p-0 border rounded-md overflow-hidden">
                <div className="w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                  <img
                    src={topic.image}
                    alt={topic.title}
                    className="w-full h-auto max-h-40 object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-gray-600 dark:text-gray-300 break-words">
                {topic.title}
              </div>
            )
          ) : (
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              お題なし（フリー回答）
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-lg leading-snug break-words whitespace-pre-wrap">
            {answer.text}
          </p>
          {getNameByProfileId((answer as any).profileId) && (
            <div className="text-xs text-gray-500 dark:text-gray-300">
              作者: {getNameByProfileId((answer as any).profileId)}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-100">
              Score:{' '}
              <span className="text-gray-900 dark:text-gray-50">{score}</span>{' '}
              コメント{comments.length}
            </div>
            <div className="flex items-center gap-2">
              <FavoriteButton
                answerId={answer.id}
                initialFavorited={initialFavorited}
                onServerFavorited={onFavoriteUpdate}
              />
              <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                aria-expanded={open}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                {open ? '閉じる' : 'コメント / 採点'}
              </button>
            </div>
          </div>
        </div>

        {open && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-4">
            <div className="space-y-2">
              <NumericVoteButtons
                answerId={answer.id}
                initialVotes={votesCounts}
                votesBy={votesBy}
                actionPath={actionPath}
              />
              <div className="text-[11px] text-gray-400 dark:text-gray-500">
                1〜3
                のボタンで採点できます。選択済みのボタンを再度押すと取り消せます。
              </div>
              <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>👍1:{votesCounts.level1}</span>
                <span>😂2:{votesCounts.level2}</span>
                <span>🤣3:{votesCounts.level3}</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium">コメント</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {comments.map(comment => (
                  <li
                    key={comment.id}
                    className="text-gray-700 dark:text-gray-100"
                  >
                    <div className="whitespace-pre-wrap">{comment.text}</div>{' '}
                    <span className="text-xs text-gray-400 dark:text-gray-400">
                      —{' '}
                      {getNameByProfileId((comment as any).profileId) ??
                        '名無し'}
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
                  <input
                    type="hidden"
                    name="answerId"
                    value={String(answer.id)}
                  />
                  <input
                    type="hidden"
                    name="profileId"
                    value={currentUserId ?? ''}
                  />
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
          </div>
        )}
      </div>
    </li>
  );
}

export default AnswerActionCard;
