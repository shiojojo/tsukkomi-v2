import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { useState } from 'react';
import * as identityStorage from '~/lib/identityStorage';
import { useIdentity } from '~/hooks/common/useIdentity';
import type { User, SubUser } from '~/lib/schemas/user';
import { Button } from '~/components/ui/Button';
import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';

/**
 * 概要: /login (開発用) - メインユーザー選択 & サブユーザー作成 / 切替 を一画面で提供。
 * Intent: localStorage ベースの簡易ログイン状態 (currentUserId / currentSubUserId 等) を操作し、他ページで参照可能にする。
 * Contract:
 *   - loader: { users: User[] }
 *   - 書き込み操作は提供せず、既存ユーザーの選択のみを行う。
 * Environment: prod/dev 共通で DB (profiles) を参照。書込みは Supabase 経由 (lib/db.ts 内部)。
 * Errors: バリデーション失敗時は { ok:false, errors }。DB エラーは 500 例外 -> ルートエラー境界へ。
 */

export function meta() {
  return [
    { title: 'Tsukkomi V2 - Login' },
    { name: 'description', content: 'Login to Tsukkomi V2' },
  ];
}
export async function loader(_args: LoaderFunctionArgs) {
  const { getUsers } = await import('~/lib/db');
  const users = await getUsers();
  return Response.json({ users });
}

export default function LoginRoute() {
  const data = useLoaderData() as { users: User[] };
  const users = data.users;

  const {
    mainId: currentUserId,
    mainName: currentUserName,
    subId: currentSubUserId,
    subName: currentSubUserName,
  } = useIdentity();
  const [selectedMainId, setSelectedMainId] = useState<string | null>(null);

  function selectMain(u: User) {
    identityStorage.setItem('currentUserId', u.id);
    identityStorage.setItem('currentUserName', u.name ?? '');
    identityStorage.removeItem('currentSubUserId');
    identityStorage.removeItem('currentSubUserName');
    // refresh() is not needed as storage event will trigger update
    window.location.href = '/';
  }

  function selectSub(sub: SubUser, parent: User) {
    identityStorage.setItem('currentUserId', parent.id);
    identityStorage.setItem('currentUserName', parent.name ?? '');
    identityStorage.setItem('currentSubUserId', sub.id);
    identityStorage.setItem('currentSubUserName', sub.name);
    // refresh() is not needed as storage event will trigger update
    window.location.href = '/';
  }

  function clearSub() {
    identityStorage.removeItem('currentSubUserId');
    identityStorage.removeItem('currentSubUserName');
    // refresh() is not needed as storage event will trigger update
    window.location.href = '/';
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-bold text-foreground mb-2">
          ログイン（開発用）
        </h1>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          メインユーザーを選択、またはサブユーザーを作成して切り替えます。
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold mb-2">現在の状態</h2>
        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
          <div>メイン: {currentUserName ?? '未選択'}</div>
          <div>
            サブ:{' '}
            {currentSubUserName ? (
              <>
                {currentSubUserName}{' '}
                <button className="text-blue-600 ml-2" onClick={clearSub}>
                  メインに戻る
                </button>
              </>
            ) : (
              'なし'
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">メインユーザー一覧</h2>
        <ul className="space-y-3">
          {users.map(u => (
            <li key={u.id} className="border rounded-md p-3 bg-card/70">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">{u.name}</div>
                  <div className="text-[10px] text-gray-500">{u.id}</div>
                </div>
                {currentUserId === u.id && !currentSubUserId ? (
                  <span className="text-green-600 text-xs">選択中</span>
                ) : (
                  <Button
                    variant="small"
                    active={true}
                    onClick={() => selectMain(u)}
                  >
                    {currentUserId === u.id ? '再選択' : '選択'}
                  </Button>
                )}
                <Button
                  variant="small"
                  active={false}
                  type="button"
                  onClick={() =>
                    setSelectedMainId(s => (s === u.id ? null : u.id))
                  }
                >
                  {selectedMainId === u.id ? '閉じる' : '詳細'}
                </Button>
              </div>

              {selectedMainId === u.id && (
                <div className="mt-3 space-y-3">
                  <div>
                    <h3 className="text-xs font-semibold mb-1">サブユーザー</h3>
                    {u.subUsers && u.subUsers.length ? (
                      <ul className="space-y-1">
                        {u.subUsers.map((s: SubUser) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between"
                          >
                            <span className="text-xs">{s.name}</span>
                            {currentSubUserId === s.id ? (
                              <span className="text-green-600 text-[10px]">
                                使用中
                              </span>
                            ) : (
                              <Button
                                variant="tertiary"
                                onClick={() => selectSub(s, u)}
                              >
                                切替
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[11px] text-gray-500">サブなし</div>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ErrorBoundary() {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
