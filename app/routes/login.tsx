import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, useFetcher } from 'react-router';
import { useEffect, useState } from 'react';
import { SubUserCreateSchema } from '~/lib/schemas/user';

/**
 * 概要: /login (開発用) - メインユーザー選択 & サブユーザー作成 / 切替 を一画面で提供。
 * Intent: localStorage ベースの簡易ログイン状態 (currentUserId / currentSubUserId 等) を操作し、他ページで参照可能にする。
 * Contract:
 *   - loader: { users: User[] }
 *   - action (intent=add-subuser): { ok: true, sub, parentId } | { ok: false, errors }
 * Environment: prod/dev 共通で DB (profiles) を参照。書込みは Supabase 経由 (lib/db.ts 内部)。
 * Errors: バリデーション失敗時は { ok:false, errors }。DB エラーは 500 例外 -> ルートエラー境界へ。
 */
export async function loader(_args: LoaderFunctionArgs) {
  const { getUsers } = await import('~/lib/db');
  const users = await getUsers();
  return { users };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = String(form.get('intent') || '');
  if (intent === 'add-subuser') {
    const parentId = String(form.get('parentId') || '');
    const name = String(form.get('name') || '');
    const parsed = SubUserCreateSchema.safeParse({ parentId, name });
    if (!parsed.success)
      return { ok: false, errors: parsed.error.format() } as any;
    const { addSubUser } = await import('~/lib/db');
    const sub = await addSubUser(parsed.data);
    return { ok: true, sub, parentId } as any;
  }
  return { ok: false } as any;
}

export default function LoginRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const users = data.users as any[];
  const createFetcher = useFetcher();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentSubUserId, setCurrentSubUserId] = useState<string | null>(null);
  const [currentSubUserName, setCurrentSubUserName] = useState<string | null>(
    null
  );
  const [selectedMainId, setSelectedMainId] = useState<string | null>(null);

  // 初期状態読み込み
  useEffect(() => {
    try {
      setCurrentUserId(localStorage.getItem('currentUserId'));
      setCurrentUserName(localStorage.getItem('currentUserName'));
      setCurrentSubUserId(localStorage.getItem('currentSubUserId'));
      setCurrentSubUserName(localStorage.getItem('currentSubUserName'));
    } catch {}
  }, []);

  // サブユーザー作成完了時: 直ちにそのサブをアクティブ化しトップへ遷移
  useEffect(() => {
    if (
      createFetcher.state === 'idle' &&
      createFetcher.data &&
      (createFetcher.data as any).ok &&
      (createFetcher.data as any).sub
    ) {
      try {
        const sub = (createFetcher.data as any).sub;
        const parentId = String((createFetcher.data as any).parentId || '');
        const parent = users.find(u => u.id === parentId);
        localStorage.setItem('currentUserId', parentId);
        if (parent) localStorage.setItem('currentUserName', parent.name);
        localStorage.setItem('currentSubUserId', sub.id);
        localStorage.setItem('currentSubUserName', sub.name);
      } catch {}
      window.location.href = '/';
    }
  }, [createFetcher.state, createFetcher.data, users]);

  function selectMain(u: any) {
    try {
      localStorage.setItem('currentUserId', u.id);
      localStorage.setItem('currentUserName', u.name ?? '');
      localStorage.removeItem('currentSubUserId');
      localStorage.removeItem('currentSubUserName');
    } catch {}
    window.location.href = '/';
  }

  function selectSub(sub: any, parent: any) {
    try {
      localStorage.setItem('currentUserId', parent.id);
      localStorage.setItem('currentUserName', parent.name ?? '');
      localStorage.setItem('currentSubUserId', sub.id);
      localStorage.setItem('currentSubUserName', sub.name);
    } catch {}
    window.location.href = '/';
  }

  function clearSub() {
    try {
      localStorage.removeItem('currentSubUserId');
      localStorage.removeItem('currentSubUserName');
    } catch {}
    window.location.href = '/';
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
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
            <li
              key={u.id}
              className="border rounded-md p-3 bg-white/70 dark:bg-gray-900/60"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">{u.name}</div>
                  <div className="text-[10px] text-gray-500">{u.id}</div>
                </div>
                {currentUserId === u.id && !currentSubUserId ? (
                  <span className="text-green-600 text-xs">選択中</span>
                ) : (
                  <button
                    onClick={() => selectMain(u)}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {currentUserId === u.id ? '再選択' : '選択'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMainId(s => (s === u.id ? null : u.id))
                  }
                  className="text-xs px-2 py-1 border rounded"
                >
                  {selectedMainId === u.id ? '閉じる' : '詳細'}
                </button>
              </div>

              {selectedMainId === u.id && (
                <div className="mt-3 space-y-3">
                  <div>
                    <h3 className="text-xs font-semibold mb-1">サブユーザー</h3>
                    {u.subUsers && u.subUsers.length ? (
                      <ul className="space-y-1">
                        {u.subUsers.map((s: any) => (
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
                              <button
                                onClick={() => selectSub(s, u)}
                                className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
                              >
                                切替
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[11px] text-gray-500">サブなし</div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-[11px] font-semibold mb-1">
                      サブユーザー作成
                    </h4>
                    <createFetcher.Form method="post" className="flex gap-2">
                      <input type="hidden" name="intent" value="add-subuser" />
                      <input type="hidden" name="parentId" value={u.id} />
                      <input
                        name="name"
                        placeholder="名前"
                        className="flex-1 border rounded px-2 py-1 text-xs"
                        aria-label="サブユーザー名"
                        required
                        maxLength={100}
                      />
                      <button
                        type="submit"
                        className="text-xs px-2 py-1 rounded bg-blue-500 text-white"
                        disabled={createFetcher.state !== 'idle'}
                      >
                        追加
                      </button>
                    </createFetcher.Form>
                    {createFetcher.state !== 'idle' && (
                      <div className="text-[10px] text-gray-500 mt-1">
                        作成中…
                      </div>
                    )}
                    {createFetcher.data &&
                      (createFetcher.data as any).ok === false && (
                        <div className="text-[10px] text-red-600 mt-1">
                          エラー: 入力を確認してください。
                        </div>
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
