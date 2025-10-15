import { useFetcher } from 'react-router';
import { useIdentity } from './useIdentity';

/**
 * 概要: 楽観的更新を伴うサーバーアクションを実行するカスタムフック。
 * Intent: FavoriteButton や NumericVoteButtons などのコンポーネントで重複する、fetcher を使った POST とログイン確認のロジックを共通化。
 * Contract:
 *   - actionPath: アクションの送信先パス（例: '/answers/favorite'）
 *   - loginRedirectPath: 未ログイン時のリダイレクト先（デフォルト: '/login'）
 *   - 戻り値: { fetcher, performAction } - fetcher は React Router の useFetcher、performAction はデータ送信関数
 * Environment: ブラウザ専用（window.location 使用）。SSR では非アクティブ。
 * Errors: 未ログイン時はリダイレクト。fetcher のエラーは呼び出し側で処理。
 */
export function useOptimisticAction<T extends Record<string, unknown>>(
  actionPath: string,
  loginRedirectPath: string = '/login'
) {
  const fetcher = useFetcher();
  const { effectiveId } = useIdentity();

  const performAction = (data: T) => {
    if (!effectiveId) {
      if (typeof window !== 'undefined') {
        window.location.href = loginRedirectPath;
      }
      return;
    }
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    fetcher.submit(formData, { method: 'POST', action: actionPath });
  };

  return { fetcher, performAction };
}