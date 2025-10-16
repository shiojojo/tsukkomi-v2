import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useFetcher } from 'react-router';
import { consumeToken } from '~/lib/rateLimiter';
import { getItem, setItem, removeItem } from '~/lib/identityStorage';
import { useEffect, useState } from 'react';
import { useIdentity } from '~/hooks/common/useIdentity';
import { SubUserCreateSchema } from '~/lib/schemas/user';
import type { User, SubUser } from '~/lib/schemas/user';
import { Button } from '~/components/ui/Button';
import { ErrorBoundary as ErrorBoundaryComponent } from '~/components/common/ErrorBoundary';
import { useThemeStore } from '~/lib/store';
import { ListPageLayout } from '~/components/layout/ListPageLayout';

/**
 * 概要: /me ページ - 開発向けにサブユーザーの作成 / 削除 / 切替 を提供する。
 * Intent: ローカルの currentUser / currentSubUser を操作できる簡易 UI。
 * Contract:
 *  - loader: { users: User[] }
 *  - action: intent=add-subuser | remove-subuser -> returns { ok, sub?, parentId?, subId? }
 * Environment: dev は in-memory mock を使う (lib/db の分岐に従う)
 * Errors: バリデーションエラーは { ok: false, errors } を返す
 */
export async function loader(_args: LoaderFunctionArgs) {
  const { getUsers } = await import('~/lib/db');
  const users = await getUsers();
  return Response.json({ users });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  // basic rate limiting to protect this dev endpoint from storms
  const parentId = form.get('parentId')
    ? String(form.get('parentId'))
    : undefined;
  let rateKey = 'anon';
  if (parentId) rateKey = `p:${parentId}`;
  else {
    const hdr =
      request.headers && request.headers.get
        ? request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip')
        : null;
    if (hdr) rateKey = `ip:${String(hdr).split(',')[0].trim()}`;
  }
  // if no token available, return 429
  if (!consumeToken(rateKey, 1)) {
    return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const intent = form.get('intent') ? String(form.get('intent')) : '';

  if (intent === 'add-subuser') {
    const name = String(form.get('name') || '');
    const parentId = String(form.get('parentId') || '');
    const parsed = SubUserCreateSchema.safeParse({ name, parentId });
    if (!parsed.success)
      return new Response(
        JSON.stringify({ ok: false, errors: parsed.error.format() }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    const { addSubUser } = await import('~/lib/db');
    const sub = await addSubUser(parsed.data);
    return Response.json({ ok: true, sub, parentId });
  }

  if (intent === 'remove-subuser') {
    const parentId = String(form.get('parentId') || '');
    const subId = String(form.get('subId') || '');
    const { removeSubUser } = await import('~/lib/db');
    const ok = await removeSubUser(parentId, subId);
    return Response.json({ ok, parentId, subId });
  }

  return Response.json({ ok: false }, { status: 400 });
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

  // fetchers for mutate actions
  const add = useFetcher();
  const remove = useFetcher();

  type ActionData = {
    ok: boolean;
    sub?: SubUser;
    parentId?: string;
  };

  // Handle add result: set the created sub-user as active
  useEffect(() => {
    if (
      add.state === 'idle' &&
      add.data &&
      (add.data as ActionData).ok &&
      (add.data as ActionData).sub
    ) {
      const sub = (add.data as ActionData).sub!;
      const parentId = String((add.data as ActionData).parentId || '');
      setItem('currentUserId', parentId);
      const parent = users.find(u => u.id === parentId);
      if (parent) setItem('currentUserName', parent.name ?? '');
      setItem('currentSubUserId', sub.id);
      setItem('currentSubUserName', sub.name);
      // Trigger identity change event instead of reload
      window.dispatchEvent(new Event('identity-change'));
    }
  }, [add.state, add.data]);

  // Handle remove result: if removed sub was active, clear sub selection
  useEffect(() => {
    if (remove.state === 'idle' && remove.data && remove.data.ok) {
      const removedId = String(remove.data.subId || '');
      if (getItem('currentSubUserId') === removedId) {
        removeItem('currentSubUserId');
        removeItem('currentSubUserName');
      }
      // Trigger identity change event instead of reload
      window.dispatchEvent(new Event('identity-change'));
    }
  }, [remove.state, remove.data]);

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
            <h2 className="text-sm font-semibold">サブユーザーを追加</h2>
            {currentUserId ? (
              <add.Form method="post" className="flex gap-2 mt-2">
                <input type="hidden" name="intent" value="add-subuser" />
                <input
                  type="hidden"
                  name="parentId"
                  value={currentUserId ?? ''}
                />
                <input
                  name="name"
                  className="form-input flex-1"
                  placeholder="サブユーザー名"
                />
                <button className="btn-inline" type="submit">
                  作成
                </button>
              </add.Form>
            ) : (
              <div className="text-xs text-muted-foreground mt-2">
                まずメインアカウントを選択してください。
              </div>
            )}
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
                          <button
                            className="text-sm text-primary"
                            onClick={() =>
                              switchToSub(
                                s,
                                users.find(u => u.id === currentUserId)!
                              )
                            }
                          >
                            切替
                          </button>
                          <remove.Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="remove-subuser"
                            />
                            <input
                              type="hidden"
                              name="parentId"
                              value={currentUserId ?? ''}
                            />
                            <input type="hidden" name="subId" value={s.id} />
                            <Button variant="destructive">削除</Button>
                          </remove.Form>
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
  );
}

export function ErrorBoundary() {
  return (
    <ErrorBoundaryComponent showDetails={import.meta.env.DEV}>
      <div />
    </ErrorBoundaryComponent>
  );
}
