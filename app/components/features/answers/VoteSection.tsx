import { useMemo, useState } from 'react';
import NumericVoteButtons from '~/components/common/NumericVoteButtons';
import { useNumericVoteButtons } from '~/hooks/features/answers/useNumericVoteButtons';
import type { Answer } from '~/lib/schemas/answer';
import type { ReactNode } from 'react';

interface VoteSectionProps {
  answer: Answer;
  userAnswerData: { votes: Record<number, number> };
  actionPath: string;
  profileIdForVotes?: string | null;
  currentUserId: string | null;
  getNameByProfileId: (pid?: string | null) => string | undefined;
  currentUserName: string | null;
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

export function VoteSection({
  answer,
  userAnswerData,
  actionPath,
  profileIdForVotes,
  currentUserId,
  getNameByProfileId,
  currentUserName,
}: VoteSectionProps): ReactNode {
  const profileForVote = profileIdForVotes ?? currentUserId ?? null;

  const [votesBy, setVotesBy] = useState(() => {
    const embedded = (answer.votesBy ?? {}) as Record<string, number>;
    const combined = { ...embedded };
    // Add userAnswerData for current user
    if (profileForVote && userAnswerData.votes[answer.id] !== undefined) {
      combined[profileForVote] = userAnswerData.votes[answer.id];
    }
    return Object.keys(combined).length ? combined : undefined;
  });

  const resolveProfileName = (pid?: string | null) => {
    if (!pid) return undefined;
    if (pid === profileForVote && currentUserName) {
      return currentUserName;
    }
    return getNameByProfileId(pid);
  };

  const { votesCounts } = useMemo(() => {
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
      return { votesCounts: fallbackCounts };
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

    return { votesCounts: counts };
  }, [answer, votesBy]);

  const { selection, counts, handleVote } = useNumericVoteButtons({
    answerId: answer.id,
    initialVotes: votesCounts,
    votesBy,
    actionPath,
    onSelectionChange: level => {
      setVotesBy(prev => {
        const newVotesBy = { ...(prev || {}) };
        if (level === null) {
          delete newVotesBy[profileForVote!];
        } else {
          newVotesBy[profileForVote!] = level;
        }
        return Object.keys(newVotesBy).length ? newVotesBy : undefined;
      });
    },
  });

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

  return (
    <div className="space-y-2">
      <NumericVoteButtons
        selection={selection}
        counts={counts}
        onVote={handleVote}
      />
      <div className="text-[11px] text-gray-400 dark:text-gray-500">
        1〜3 のボタンで採点できます。選択済みのボタンを再度押すと取り消せます。
      </div>
      <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>👍1:{counts.level1}</span>
        <span>😂2:{counts.level2}</span>
        <span>🤣3:{counts.level3}</span>
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
    </div>
  );
}
