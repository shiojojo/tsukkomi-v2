import { useState } from 'react';
import { CommentSection } from './CommentSection';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import { Button } from '~/components/ui/Button';

export interface AnswerActionCardProps {
  answer: Answer;
  topic: Topic | null;
  getNameByProfileId: (pid?: string | null) => string | undefined;
}

/**
 * 概要: お題情報付きの読み取り専用回答カード。既存コメントの閲覧のみ提供する。
 * Intent: /answers, /answers/favorites, /topics/:id など複数スクリーンで UI を統一し再利用する。
 * Contract:
 *   - props.answer は loader が取得した回答情報を含む。
 *   - コメント、投票、お気に入りの書き込み操作は提供しない。
 * Environment:
 *   - ブラウザ専用。コメントは明示的に開いたときだけ取得する。
 */
export function AnswerActionCard({
  answer,
  topic,
  getNameByProfileId,
}: AnswerActionCardProps) {
  const [open, setOpen] = useState(false);

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
                className={`text-sm font-medium ${score === 0 ? 'text-gray-500' : 'text-foreground'}`}
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
                className={`text-sm font-medium cursor-pointer ${(answer.commentCount || 0) === 0 ? 'text-gray-500' : 'text-foreground'}`}
                onClick={() => setOpen(prev => !prev)}
              >
                コメント: {answer.commentCount || 0}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="linkNoHover"
                  style={{ color: 'hsl(var(--primary))' }}
                  type="button"
                  onClick={() => setOpen(prev => !prev)}
                  aria-expanded={open}
                >
                  {open ? '閉じる' : 'コメントを見る'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {open && (
          <div className="pt-3 border-t border-border space-y-4">
            <CommentSection
              comments={[]}
              answerId={answer.id}
              getNameByProfileId={getNameByProfileId}
              enabled={open}
            />
          </div>
        )}
      </div>
    </li>
  );
}

export default AnswerActionCard;
