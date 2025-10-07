import { useIdentityStore } from '~/lib/store';

/**
 * 概要: localStorage に保存されたメイン/サブユーザー情報をリアクティブに提供するフック。
 * Intent: ナビゲーション等で現在の表示ユーザー (サブ優先) を即時反映し再読込不要化。
 * Contract:
 *  - effectiveId/effectiveName: サブユーザーが存在すればその id/name、なければメイン。
 *  - mainId/mainName: currentUserId/currentUserName。
 *  - subId/subName: currentSubUserId/currentSubUserName (無ければ null)。
 * Environment: localStorage が無い (SSR) 時は全て null を返す。
 * Errors: 例外は握りつぶし安全に null。
 */
export function useIdentity() {
  const { mainId, mainName, subId, subName, effectiveId, effectiveName, refresh } = useIdentityStore();

  return { mainId, mainName, subId, subName, effectiveId, effectiveName, refresh };
}
