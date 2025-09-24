import { useEffect, useState, useCallback } from 'react';

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
  // 初期描画は SSR と同じ (全て null) にすることで hydration mismatch を防止
  const [state, setState] = useState<ReturnType<typeof empty>>(() => empty());

  // 初回 + storage/identity-change で同期
  useEffect(() => {
    const apply = () => {
      try { setState(read()); } catch { /* ignore */ }
    };
    apply(); // mount 時に読み込み
    try {
      window.addEventListener('storage', apply);
      window.addEventListener('identity-change', apply as any);
    } catch {}
    return () => {
      try {
        window.removeEventListener('storage', apply);
        window.removeEventListener('identity-change', apply as any);
      } catch {}
    };
  }, []);

  const refresh = useCallback(() => {
    try { setState(read()); } catch {}
  }, []);

  return { ...state, refresh };
}

function empty() {
  return {
    mainId: null as string | null,
    mainName: null as string | null,
    subId: null as string | null,
    subName: null as string | null,
    effectiveId: null as string | null,
    effectiveName: null as string | null,
  } as const;
}

function read() {
  if (typeof window === 'undefined') return empty();
  try {
    const mainId = localStorage.getItem('currentUserId');
    const mainName = localStorage.getItem('currentUserName');
    const subId = localStorage.getItem('currentSubUserId');
    const subName = localStorage.getItem('currentSubUserName');
    return {
      mainId,
      mainName,
      subId,
      subName,
      effectiveId: subId || mainId,
      effectiveName: subName || mainName,
    } as const;
  } catch { return empty(); }
}

/**
 * 同タブで localStorage を書き換えた直後に UI 更新させたい場合に呼び出す補助。
 */
export function dispatchIdentityChange() {
  try { window.dispatchEvent(new Event('identity-change')); } catch {}
}
