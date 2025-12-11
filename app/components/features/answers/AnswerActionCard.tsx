import { useState } from 'react';
import { VoteSection } from './VoteSection';
import { CommentSection } from './CommentSection';
import { FavoriteSection } from './FavoriteSection';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import { Button } from '~/components/ui/Button';

export interface AnswerActionCardProps {
  answer: Answer;
  topic: Topic | null;
  currentUserId: string | null;
  currentUserName: string | null;
  getNameByProfileId: (pid?: string | null) => string | undefined;
  userAnswerData: { votes: Record<number, number> };
  actionPath: string;
  profileIdForVotes?: string | null;
}

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
  currentUserId,
  currentUserName,
  getNameByProfileId,
  userAnswerData,
  actionPath,
  profileIdForVotes,
}: AnswerActionCardProps) {
  const [open, setOpen] = useState(false);
  const [realTimeCommentCount, setRealTimeCommentCount] = useState(
    answer.commentCount || 0
  );

  // Calculate score from answer.votes
  const score = (() => {
    const votes = answer.votes || { level1: 0, level2: 0, level3: 0 };
    return (
      (votes.level1 || 0) * 1 +
      (votes.level2 || 0) * 2 +
      (votes.level3 || 0) * 3
    );
  })();

  return (
    <li className="p-4 border rounded-md bg-card/80">
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
              <div className="text-lg font-semibold break-words">
                {topic.title}
              </div>
            )
          ) : (
            <div className="text-lg font-semibold text-gray-600 dark:text-gray-300">
              お題なし（フリー回答）
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-lg font-semibold leading-snug break-words whitespace-pre-wrap">
            {answer.text}
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div
                className={`text-sm font-medium cursor-pointer ${score === 0 ? 'text-gray-500' : 'text-foreground'}`}
                onClick={() => setOpen(prev => !prev)}
              >
                Score: {score}
              </div>
              {getNameByProfileId(answer.profileId) && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  作者: {getNameByProfileId(answer.profileId)}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <div
                className={`text-sm font-medium cursor-pointer ${realTimeCommentCount === 0 ? 'text-gray-500' : 'text-foreground'}`}
                onClick={() => setOpen(prev => !prev)}
              >
                コメント: {realTimeCommentCount}
              </div>
              <div className="flex items-center gap-2">
                <FavoriteSection answer={answer} />
                <Button
                  variant="linkNoHover"
                  style={{ color: 'hsl(var(--primary))' }}
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
          <div className="pt-3 border-t border-border space-y-4">
            <VoteSection
              answer={answer}
              userAnswerData={userAnswerData}
              actionPath={actionPath}
              profileIdForVotes={profileIdForVotes}
              currentUserId={currentUserId}
              getNameByProfileId={getNameByProfileId}
              currentUserName={currentUserName}
            />

            <CommentSection
              comments={[]}
              answerId={answer.id}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              getNameByProfileId={getNameByProfileId}
              actionPath={actionPath}
              onCommentCountChange={setRealTimeCommentCount}
              enabled={open}
              initialCommentCount={answer.commentCount || 0}
            />
          </div>
        )}
      </div>
    </li>
  );
}

export default AnswerActionCard;
