import { Pagination } from '~/components/common/Pagination';
import AnswerActionCard from './AnswerActionCard';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';

interface AnswersListProps {
  answers: Answer[];
  topicsById?: Record<string, Topic>;
  topic?: Topic; // topics.$id.tsx 用
  commentsByAnswer: Record<string, Comment[]>;
  getNameByProfileId: (pid?: string | null) => string | undefined;
  currentUserName: string | null;
  currentUserId: string | null;
  userAnswerData: { votes: Record<number, number> };
  actionPath: string;
  profileIdForVotes?: string | null;
  pagination?: {
    currentPage: number;
    pageCount: number;
    buildHref: (page: number) => string;
  };
  emptyMessage?: string;
}

export function AnswersList({
  answers,
  topicsById,
  topic,
  commentsByAnswer,
  getNameByProfileId,
  currentUserName,
  currentUserId,
  userAnswerData,
  actionPath,
  profileIdForVotes,
  pagination,
  emptyMessage = '表示される回答がありません。',
}: AnswersListProps) {
  if (answers.length === 0) {
    return (
      <div className="px-4 py-4">
        <p className="text-gray-600 dark:text-white">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-4 space-y-4 w-full">
        <ul className="space-y-4">
          {answers.map(answer => {
            // トピックを取得（topicsById または直接の topic から）
            const answerTopic: Topic | null =
              topic ||
              (answer.topicId
                ? topicsById?.[String(answer.topicId)] || null
                : null);

            return (
              <AnswerActionCard
                key={answer.id}
                answer={answer}
                topic={
                  topic ||
                  (topicsById ? topicsById[answer.topicId || ''] : null)
                }
                comments={commentsByAnswer[answer.id] || []}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                getNameByProfileId={getNameByProfileId}
                userAnswerData={userAnswerData}
                actionPath={actionPath}
                profileIdForVotes={profileIdForVotes}
              />
            );
          })}
        </ul>
      </div>

      {pagination && (
        <Pagination
          currentPage={pagination.currentPage}
          pageCount={pagination.pageCount}
          buildHref={pagination.buildHref}
          className="px-4"
        />
      )}
    </>
  );
}
