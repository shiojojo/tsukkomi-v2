import { memo, useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { logger } from '~/lib/logger';

export type FavoriteButtonProps = {
  answerId: number;
  initialFavorited?: boolean;
  onServerFavorited?: (answerId: number, favorited: boolean) => void;
  loginRedirectPath?: string;
};

/**
 * 概要: 回答に対するお気に入りトグルボタン。クリックで即座に UI を更新しつつ、サーバー action へ POST する。
 * Intent: routes から共通ロジックを切り出し、/answers や /topics など複数画面で一貫した挙動を提供する。
 * Contract:
 *   - Props.initialFavorited で初期状態を指定。サーバー応答 (favorited:boolean) が来た場合 onServerFavorited を通知。
 *   - localStorage から currentSubUserId / currentUserId を読み取り、未ログイン時は loginRedirectPath へ遷移。
 * Environment: ブラウザ限定。fetcher を利用するため routes 側で action を実装していることが前提。
 * Errors: fetcher.error は握りつぶしつつコンソールにログ。致命的エラーは UI を既存状態にロールバック。
 */
const FavoriteButton = memo(function FavoriteButton({
  answerId,
  initialFavorited,
  onServerFavorited,
  loginRedirectPath = '/login',
}: FavoriteButtonProps) {
  const fetcher = useFetcher();
  const [currentUserIdLocal, setCurrentUserIdLocal] = useState<string | null>(
    null
  );
  const [fav, setFav] = useState<boolean>(() => Boolean(initialFavorited));
  const lastProcessedResponseRef = useRef<string | null>(null);

  useEffect(() => {
    if (fetcher.state === 'submitting') {
      lastProcessedResponseRef.current = null;
    }
  }, [fetcher.state]);

  useEffect(() => {
    logger.log(
      `[FavoriteButton ${answerId}] initialFavorited changed:`,
      initialFavorited
    );
    setFav(Boolean(initialFavorited));
  }, [answerId, initialFavorited]);

  useEffect(() => {
    try {
      const uid =
        localStorage.getItem('currentSubUserId') ??
        localStorage.getItem('currentUserId');
      setCurrentUserIdLocal(uid);
    } catch {
      setCurrentUserIdLocal(null);
    }
  }, [answerId]);

  useEffect(() => {
    if (!fetcher.data || fetcher.state !== 'idle') return;

    const rawPayload =
      typeof fetcher.data === 'string'
        ? fetcher.data
        : JSON.stringify(fetcher.data);

    if (lastProcessedResponseRef.current === rawPayload) return;
    lastProcessedResponseRef.current = rawPayload;

    try {
      const parsed =
        typeof fetcher.data === 'string'
          ? JSON.parse(fetcher.data)
          : fetcher.data;
      if (parsed && typeof parsed.favorited === 'boolean') {
        const next = Boolean(parsed.favorited);
        setFav(next);
        onServerFavorited?.(answerId, next);
        return;
      }
      if (parsed && parsed.ok === false) {
        setFav(s => !s);
      }
    } catch (error) {
      logger.error(
        `[FavoriteButton ${answerId}] Failed to parse fetcher response`,
        error
      );
    }
  }, [fetcher.data, fetcher.state, answerId, onServerFavorited]);

  const handleClick = () => {
    if (!currentUserIdLocal) {
      try {
        window.location.href = loginRedirectPath;
      } catch {}
      return;
    }
    setFav(s => !s);
    const fd = new FormData();
    fd.set('op', 'toggle');
    fd.set('answerId', String(answerId));
    fd.set('profileId', String(currentUserIdLocal));
    fetcher.submit(fd, { method: 'post' });
  };

  return (
    <button
      type="button"
      aria-pressed={fav}
      onClick={handleClick}
      className={`p-2 rounded-md ${fav ? 'text-red-500' : 'text-gray-400 dark:text-white'} hover:opacity-90`}
      title={
        !currentUserIdLocal
          ? 'ログインしてお気に入り登録'
          : fav
            ? 'お気に入り解除'
            : 'お気に入り'
      }
    >
      {fav ? (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24z" />
        </svg>
      )}
    </button>
  );
});

export default FavoriteButton;
