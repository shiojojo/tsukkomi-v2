import { useMemo } from 'react';
import type { User } from '~/lib/schemas/user';

/**
 * 概要: ユーザーリストからプロファイルIDと名前のマップを作成し、名前取得関数を提供するカスタムフック。
 * Contract:
 *   - Input: users: User[] – ユーザー情報の配列（メインとサブユーザーを含む）。
 *   - Output: { nameByProfileId: Record<string, string>, getNameByProfileId: (pid?: string | null) => string | undefined } – マップと名前取得関数。
 * Environment:
 *   - dev: モックデータを使用。
 *   - prod: Supabaseから取得した実データを使用。
 * Errors: 入力が不正な場合、undefinedを返す（例外は投げない）。
 * ユーザー数が200を超える場合、パフォーマンスに影響する可能性があるため、実装の変更が必要。
 */
export function useNameByProfileId(users: User[]) {
  const nameByProfileId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const user of users) {
      map[String(user.id)] = user.name;
      for (const sub of user.subUsers ?? []) {
        map[String(sub.id)] = sub.name;
      }
    }
    return map;
  }, [users]);

  const getNameByProfileId = (pid?: string | null) => {
    if (!pid) return undefined;
    return nameByProfileId[String(pid)];
  };

  return { nameByProfileId, getNameByProfileId };
}