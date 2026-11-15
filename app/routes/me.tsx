import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { setItem, removeItem } from '~/lib/identityStorage';
import React, { useEffect, useState } from 'react';
import { useIdentity } from '~/hooks/common/useIdentity';
import type { User, SubUser } from '~/lib/schemas/user';
import { Button } from '~/components/ui/Button';
import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';
import { useThemeStore } from '~/lib/store';
import { ListPageLayout } from '~/components/layout/ListPageLayout';

/**
 * 概要: /me ページ - 既存ユーザー / サブユーザーのローカル切替を提供する。
 * Intent: ローカルの currentUser / currentSubUser を操作できる簡易 UI。
 * Contract:
 *  - loader: { users: User[] }
 *  - DB書き込みは提供しない。
 * Environment: dev は in-memory mock を使う (lib/db の分岐に従う)
 * Errors: バリデーションエラーは { ok: false, errors } を返す
 */
export async function loader(_args: LoaderFunctionArgs) {
  const { getUsers } = await import('~/lib/db');
  const users = await getUsers();
  return Response.json({ users });
}

export default function MeRoute() {
  const data = useLoaderData() as { users: User[] };
  const users = data.users;

  const {
    mainId: currentUserId,
    mainName: currentUserName,
    subId: currentSubUserId,
    subName: currentSubUserName,
  } = useIdentity();

  const { theme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getThemeLabel = () => {
    if (theme === 'light') return 'ライト';
    if (theme === 'dark') return 'ダーク';
    return 'システム';
  };

  // hydration後のテーマ同期
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  function selectMain(user: User) {
    setItem('currentUserId', user.id);
    setItem('currentUserName', user.name ?? '');
    // clear any sub selection
    removeItem('currentSubUserId');
    removeItem('currentSubUserName');
    // Trigger identity change event instead of reload
    window.dispatchEvent(new Event('identity-change'));
  }

  function switchToSub(sub: SubUser, parent: User) {
    setItem('currentUserId', parent.id);
    setItem('currentUserName', parent.name ?? '');
    setItem('currentSubUserId', sub.id);
    setItem('currentSubUserName', sub.name);
    // Trigger identity change event instead of reload
    window.dispatchEvent(new Event('identity-change'));
  }

  // End using sub-user and return to main user (clear sub selection)
  function returnToMain() {
    removeItem('currentSubUserId');
    removeItem('currentSubUserName');
    // Trigger identity change event instead of reload
    window.dispatchEvent(new Event('identity-change'));
  }

  return (
    <React.Fragment>
      <ListPageLayout
        headerTitle="アカウント / サブユーザー"
        filters={
          <p className="text-sm text-muted-foreground mb-4">
            サブユーザーの作成・削除・切替（開発用）
          </p>
        }
        list={
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold">メインアカウントを選択</h2>
              <ul className="mt-2 space-y-2">
                {users.map((u: User) => (
                  <li key={u.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{u.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentUserId === u.id ? (
                        <span className="text-xs text-green-600">選択中</span>
                      ) : (
                        <button
                          className="btn-inline"
                          onClick={() => selectMain(u)}
                        >
                          選択
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Current status / return to main when acting as sub-user (list-item style) */}
            <section>
              {currentSubUserId ? (
                <ul className="mt-2">
                  <li className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{currentSubUserName}</div>
                      <div className="text-xs text-muted-foreground">
                        メイン: {currentUserName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-sm btn-inline"
                        onClick={returnToMain}
                      >
                        サブユーザーを終了してメインに戻る
                      </button>
                    </div>
                  </li>
                </ul>
              ) : currentUserId ? (
                <div className="text-xs text-muted-foreground">
                  現在: {currentUserName}
                </div>
              ) : null}
            </section>

            <section>
              <h2 className="text-sm font-semibold">既存のサブユーザー</h2>
              {currentUserId ? (
                <ul className="mt-2 space-y-2">
                  {users.find(u => u.id === currentUserId)?.subUsers?.length ? (
                    users
                      .find(u => u.id === currentUserId)!
                      .subUsers!.map((s: SubUser) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between"
                        >
                          <div>{s.name}</div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-sm"
                              onClick={() =>
                                switchToSub(
                                  s,
                                  users.find(u => u.id === currentUserId)!,
                                )
                              }
                            >
                              切替
                            </Button>
                          </div>
                        </li>
                      ))
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      サブユーザーがありません。
                    </div>
                  )}
                </ul>
              ) : (
                <div className="text-xs text-muted-foreground">
                  メインアカウントを選択してください。
                </div>
              )}
            </section>

            <div className="flex justify-between items-center pt-4 border-t">
              {isHydrated && (
                <button
                  onClick={toggleTheme}
                  className="btn-inline flex items-center gap-2"
                  title={`テーマ切り替え (現在: ${getThemeLabel()})`}
                >
                  {theme === 'light' ? '🌞' : theme === 'dark' ? '🌙' : '💻'}
                  <span className="text-sm">{getThemeLabel()}</span>
                </button>
              )}
            </div>
          </div>
        }
      />

    </React.Fragment>
  );
}

export function ErrorBoundary() {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
