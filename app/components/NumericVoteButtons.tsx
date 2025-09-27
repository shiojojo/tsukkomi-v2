import { useEffect, useMemo, useState } from 'react';

export type NumericVoteButtonsProps = {
  answerId: number;
  initialVotes: { level1: number; level2: number; level3: number };
  votesBy?: Record<string, number>;
  actionPath?: string;
  loginRedirectPath?: string;
};

const CONTROL_BTN_BASE =
  'inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-md text-sm font-medium border';
const CONTROL_BTN_ACTIVE = 'bg-blue-600 text-white border-blue-600';
const CONTROL_BTN_INACTIVE =
  'bg-white text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100';

/**
 * 概要: 3 段階の採点ボタン UI。ローカルストレージに状態を保存しつつ、サーバー action へ投票を送信する。
 * Intent: topics や favorites など複数画面で共通の採点 UI を提供し、重複実装を排除する。
 * Contract:
 *   - initialVotes は現在の集計。ユーザー操作で optimistic に更新し、サーバー応答が counts を返した場合に同期。
 *   - votesBy に現在のユーザーの投票レベルが含まれると選択済みとして表示。
 *   - actionPath へ POST (FormData: answerId, level, previousLevel, userId)。省略時は現在パス。
 * Environment: ブラウザ専用 (localStorage / window 参照あり)。SSR では非アクティブ。
 * Errors: fetch 失敗時は console.error にログし UI は optimism 状態を維持。
 */
export function NumericVoteButtons({
  answerId,
  initialVotes,
  votesBy,
  actionPath,
  loginRedirectPath = '/login',
}: NumericVoteButtonsProps) {
  const resolveUserId = () => {
    try {
      return (
        localStorage.getItem('currentSubUserId') ??
        localStorage.getItem('currentUserId') ??
        null
      );
    } catch {
      return null;
    }
  };

  const resolvedActionPath = useMemo(() => {
    if (actionPath) return actionPath;
    if (typeof window !== 'undefined') return window.location.pathname;
    return '/';
  }, [actionPath]);

  const readStoredSelection = () => {
    if (typeof window === 'undefined') return null;
    const uid = resolveUserId();
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
  const [counts, setCounts] = useState(() => ({ ...initialVotes }));

  useEffect(() => {
    setCounts({ ...initialVotes });
  }, [initialVotes.level1, initialVotes.level2, initialVotes.level3]);

  useEffect(() => {
    const next = readStoredSelection();
    setSelection(next);
  }, [votesBy, answerId]);

  const persistSelection = (level: 1 | 2 | 3 | null) => {
    const uid = resolveUserId();
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
    const uid = resolveUserId();
    if (!uid) {
      try {
        window.location.href = loginRedirectPath;
      } catch {}
      return;
    }

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

    (async () => {
      try {
        const form = new FormData();
        form.append('answerId', String(answerId));
        form.append('level', String(isToggleOff ? 0 : level));
        if (typeof prev === 'number') {
          form.append('previousLevel', String(prev));
        }
        form.append('userId', String(uid));

        const res = await fetch(resolvedActionPath, {
          method: 'POST',
          body: form,
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error('vote submit failed', res.status, text);
          return;
        }

        const json = await res.json().catch(() => null);
        if (json && json.answer && json.answer.votes) {
          setCounts({
            level1: Number(json.answer.votes.level1 ?? 0),
            level2: Number(json.answer.votes.level2 ?? 0),
            level3: Number(json.answer.votes.level3 ?? 0),
          });
        }
      } catch (error) {
        console.error('vote submit error', error);
      }
    })();
  };

  const btnBase = `${CONTROL_BTN_BASE} gap-2 px-3`;
  const active = CONTROL_BTN_ACTIVE;
  const inactive = CONTROL_BTN_INACTIVE;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote(1)}
        className={`${btnBase} ${selection === 1 ? active : inactive}`}
        aria-pressed={selection === 1}
        aria-label="投票1"
        type="button"
      >
        <span>1</span>
      </button>

      <button
        onClick={() => handleVote(2)}
        className={`${btnBase} ${selection === 2 ? active : inactive}`}
        aria-pressed={selection === 2}
        aria-label="投票2"
        type="button"
      >
        <span>2</span>
      </button>

      <button
        onClick={() => handleVote(3)}
        className={`${btnBase} ${selection === 3 ? active : inactive}`}
        aria-pressed={selection === 3}
        aria-label="投票3"
        type="button"
      >
        <span>3</span>
      </button>
    </div>
  );
}

export default NumericVoteButtons;
