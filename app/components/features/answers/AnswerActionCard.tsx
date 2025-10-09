import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import FavoriteButton from '~/components/common/FavoriteButton';
import NumericVoteButtons from '~/components/common/NumericVoteButtons';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';
import { Button } from '~/components/ui/Button';

export interface AnswerActionCardProps {
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
}

const formatVoteLabel = (level: number) => {
  switch (level) {
    case 1:
      return '👍 1点';
    case 2:
      return '😂 2点';
    case 3:
      return '🤣 3点';
    default:
      return `${level}点`;
  }
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
  const [currentUserVote, setCurrentUserVote] = useState<number | null>(null);

  useEffect(() => {
    if (commentFetcher.state === 'idle' && commentFetcher.data) {
      commentFormRef.current?.reset();
      // Invalidate queries to refresh comments
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    }
  }, [commentFetcher.state, commentFetcher.data, queryClient]);

  const profileForVote = profileIdForVotes ?? currentUserId ?? null;
  const votesBy = useMemo(() => {
    const embedded = (answer.votesBy ?? {}) as Record<string, number>;
    const combined = { ...embedded };

    if (profileForVote && currentUserVote !== null) {
      combined[profileForVote] = currentUserVote;
    }
    // Add userAnswerData for current user
    if (profileForVote && userAnswerData.votes[answer.id] !== undefined) {
      combined[profileForVote] = userAnswerData.votes[answer.id];
    }

    return Object.keys(combined).length ? combined : undefined;
  }, [
    answer,
    profileForVote,
    currentUserVote,
    userAnswerData.votes,
    answer.id,
  ]);

  const resolveProfileName = useCallback(
    (pid?: string | null) => {
      if (!pid) return undefined;
      if (pid === profileForVote && currentUserName) {
        return currentUserName;
      }
      return getNameByProfileId(pid);
    },
    [currentUserName, getNameByProfileId, profileForVote]
  );

  const { votesCounts, score } = useMemo(() => {
    const fallbackCounts = (() => {
      const votes = answer.votes || {
        level1: 0,
        level2: 0,
        level3: 0,
      };
      return {
        level1: Number(votes.level1 || 0),
        level2: Number(votes.level2 || 0),
        level3: Number(votes.level3 || 0),
      };
    })();

    if (!votesBy) {
      const fallbackScore =
        fallbackCounts.level1 * 1 +
        fallbackCounts.level2 * 2 +
        fallbackCounts.level3 * 3;
      return { votesCounts: fallbackCounts, score: fallbackScore };
    }

    const aggregated = { level1: 0, level2: 0, level3: 0 };
    for (const level of Object.values(votesBy)) {
      if (level === 1) {
        aggregated.level1 += 1;
      } else if (level === 2) {
        aggregated.level2 += 1;
      } else if (level === 3) {
        aggregated.level3 += 1;
      }
    }

    const counts =
      aggregated.level1 + aggregated.level2 + aggregated.level3 > 0
        ? aggregated
        : fallbackCounts;

    const computedScore =
      counts.level1 * 1 + counts.level2 * 2 + counts.level3 * 3;

    return { votesCounts: counts, score: computedScore };
  }, [answer, votesBy]);

  const voteEntries = useMemo(() => {
    if (!votesBy)
      return [] as Array<{
        profileId: string;
        score: number;
        displayName: string;
        isCurrentUser: boolean;
      }>;

    return Object.entries(votesBy)
      .map(([profileId, score]) => ({
        profileId,
        score,
        displayName: resolveProfileName(profileId) ?? '名無し',
        isCurrentUser: profileId === profileForVote,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.displayName.localeCompare(b.displayName, 'ja');
      });
  }, [profileForVote, resolveProfileName, votesBy]);

  const initialFavorited = useMemo(() => {
    if (userAnswerData.favorites.has(answer.id)) return true;
    return Boolean(answer.favorited);
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
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-100">
                Score:{' '}
                <span className="text-gray-900 dark:text-gray-50">{score}</span>
              </div>
              {resolveProfileName(answer.profileId) && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  作者: {resolveProfileName(answer.profileId)}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-100">
                コメント{comments.length}
              </div>
              <div className="flex items-center gap-2">
                <FavoriteButton
                  answerId={answer.id}
                  initialFavorited={initialFavorited}
                  onServerFavorited={onFavoriteUpdate}
                />
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setOpen(prev => !prev)}
                  aria-expanded={open}
                >
                  {open ? '閉じる' : 'コメント / 採点'}
                </Button>
              </div>
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
                onSelectionChange={setCurrentUserVote}
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
              <h4 className="text-sm font-medium">ユーザーごとの採点</h4>
              {voteEntries.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {voteEntries.map(entry => (
                    <li
                      key={entry.profileId}
                      className="flex items-center justify-between rounded-md px-2 py-1 bg-gray-50 dark:bg-gray-900/80"
                    >
                      <span
                        className={`truncate ${entry.isCurrentUser ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-100'}`}
                      >
                        {entry.displayName}
                        {entry.isCurrentUser ? '（あなた）' : ''}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatVoteLabel(entry.score)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  まだ採点はありません。
                </p>
              )}
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
                      — {resolveProfileName(comment.profileId) ?? '名無し'}
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
