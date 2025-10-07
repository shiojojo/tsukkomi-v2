import { useEffect, useState } from 'react';
import { useIdentity } from '~/hooks/useIdentity';
import { useOptimisticAction } from '~/hooks/useOptimisticAction';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/Button';

export type NumericVoteButtonsProps = {
  answerId: number;
  initialVotes: { level1: number; level2: number; level3: number };
  votesBy?: Record<string, number>;
  actionPath?: string;
  loginRedirectPath?: string;
};
export function NumericVoteButtons({
  answerId,
  initialVotes,
  votesBy,
  actionPath,
  loginRedirectPath = '/login',
}: NumericVoteButtonsProps) {
  const { effectiveId } = useIdentity();
  const { fetcher, performAction } = useOptimisticAction(
    actionPath ||
      (typeof window !== 'undefined' ? window.location.pathname : '/'),
    loginRedirectPath
  );
  const queryClient = useQueryClient();

  const readStoredSelection = () => {
    if (typeof window === 'undefined') return null;
    const uid = effectiveId;
    if (!uid) return null;

    if (votesBy && uid in votesBy) {
      return votesBy[uid] as 1 | 2 | 3;
    }

    try {
      const key = `vote:answer:${answerId}:user:${uid}`;
      const stored = localStorage.getItem(key);
      return stored ? (Number(stored) as 1 | 2 | 3) : null;
    } catch {
      return null;
    }
  };

  const [selection, setSelection] = useState<1 | 2 | 3 | null>(
    typeof window !== 'undefined' ? readStoredSelection() : null
  );
  const [, setCounts] = useState(() => ({ ...initialVotes }));

  useEffect(() => {
    setCounts({ ...initialVotes });
  }, [initialVotes.level1, initialVotes.level2, initialVotes.level3]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSelection(readStoredSelection());
    }
  }, [votesBy, effectiveId]);

  useEffect(() => {
    if (fetcher.data && fetcher.data.answer && fetcher.data.answer.votes) {
      setCounts({
        level1: Number(fetcher.data.answer.votes.level1 ?? 0),
        level2: Number(fetcher.data.answer.votes.level2 ?? 0),
        level3: Number(fetcher.data.answer.votes.level3 ?? 0),
      });
    }
  }, [fetcher.data]);

  const persistSelection = (level: 1 | 2 | 3 | null) => {
    const uid = effectiveId;
    if (!uid) return;
    const key = `vote:answer:${answerId}:user:${uid}`;
    try {
      if (level === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, String(level));
      }
    } catch {}
  };

  const handleVote = (level: 1 | 2 | 3) => {
    const uid = effectiveId;
    const prev = selection;
    const isToggleOff = prev === level;

    setCounts(c => {
      const next = { ...c };
      if (prev === 1) next.level1 = Math.max(0, next.level1 - 1);
      if (prev === 2) next.level2 = Math.max(0, next.level2 - 1);
      if (prev === 3) next.level3 = Math.max(0, next.level3 - 1);
      if (!isToggleOff) {
        if (level === 1) next.level1 = (next.level1 || 0) + 1;
        if (level === 2) next.level2 = (next.level2 || 0) + 1;
        if (level === 3) next.level3 = (next.level3 || 0) + 1;
      }
      return next;
    });

    setSelection(isToggleOff ? null : level);
    persistSelection(isToggleOff ? null : level);

    performAction({ answerId, level: isToggleOff ? 0 : level, userId: uid });

    // Invalidate user data queries to refresh votes
    if (uid) {
      queryClient.invalidateQueries({
        queryKey: ['user-data', uid],
        exact: false,
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="control"
        active={selection === 1}
        className="gap-2 px-3"
        onClick={() => handleVote(1)}
        aria-pressed={selection === 1}
        aria-label="投票1"
        type="button"
      >
        <span>1</span>
      </Button>

      <Button
        variant="control"
        active={selection === 2}
        className="gap-2 px-3"
        onClick={() => handleVote(2)}
        aria-pressed={selection === 2}
        aria-label="投票2"
        type="button"
      >
        <span>2</span>
      </Button>

      <Button
        variant="control"
        active={selection === 3}
        className="gap-2 px-3"
        onClick={() => handleVote(3)}
        aria-pressed={selection === 3}
        aria-label="投票3"
        type="button"
      >
        <span>3</span>
      </Button>
    </div>
  );
}

export default NumericVoteButtons;
