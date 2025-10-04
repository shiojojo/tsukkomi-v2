import { memo, useEffect, useRef, useState } from 'react';
import { logger } from '~/lib/logger';
import { useIdentity } from '~/hooks/useIdentity';
import { useOptimisticAction } from '~/hooks/useOptimisticAction';
import { Button } from '~/components/ui/Button';

export type FavoriteButtonProps = {
  answerId: number;
  initialFavorited?: boolean;
  onServerFavorited?: (answerId: number, favorited: boolean) => void;
  loginRedirectPath?: string;
  actionPath?: string;
};

/**
 * 概要: 回答に対するお気に入りトグルボタン。クリックで即座に UI を更新しつつ、サーバー action へ POST する。
 * Intent: routes から共通ロジックを切り出し、/answers や /topics など複数画面で一貫した挙動を提供する。
 * Contract:
 *   - Props.initialFavorited で初期状態を指定。サーバー応答 (favorited:boolean) が来た場合 onServerFavorited を通知。
 *   - useIdentity から effectiveId を取得し、未ログイン時は loginRedirectPath へ遷移。
 * Environment: ブラウザ限定。fetcher を利用するため routes 側で action を実装していることが前提。
 * Errors: fetcher.error は握りつぶしつつコンソールにログ。致命的エラーは UI を既存状態にロールバック。
 */
const FavoriteButton = memo(function FavoriteButton({
  answerId,
  initialFavorited,
  onServerFavorited,
  loginRedirectPath = '/login',
  actionPath,
}: FavoriteButtonProps) {
  const { fetcher, performAction } = useOptimisticAction(
    actionPath ||
      (typeof window !== 'undefined' ? window.location.pathname : '/'),
    loginRedirectPath
  );
  const { effectiveId } = useIdentity();
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
    setFav(s => !s);
    performAction({ op: 'toggle', answerId, profileId: effectiveId });
  };

  return (
    <Button
      variant="icon"
      active={fav}
      type="button"
      aria-pressed={fav}
      onClick={handleClick}
      title={
        !effectiveId
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
    </Button>
  );
});

export default FavoriteButton;
