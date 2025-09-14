import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form } from 'react-router';
import { Link } from 'react-router';
// server-only imports will be dynamically loaded inside loader/action
import { SubUserCreateSchema } from '~/lib/schemas/user';
import { z } from 'zod';

export async function loader({}: LoaderFunctionArgs) {
  const { getUsers } = await import('~/lib/db');
  // return all users so UI can render subUsers for the selected parent client-side
  const users = await getUsers();
  return { users };
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const intent = form.get('intent') ? String(form.get('intent')) : '';

  if (intent === 'add-subuser') {
    const name = String(form.get('name') || '');
    const parentId = String(form.get('parentId') || '');
    const parsed = SubUserCreateSchema.safeParse({ name, parentId });
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.format() };
    }
    const { addSubUser } = await import('~/lib/db');
    const sub = await addSubUser(parsed.data);
    return { ok: true, sub };
  }

  if (intent === 'remove-subuser') {
    const parentId = String(form.get('parentId') || '');
    const subId = String(form.get('subId') || '');
    const { removeSubUser } = await import('~/lib/db');
    const ok = await removeSubUser(parentId, subId);
    return { ok };
  }

  return { ok: false };
}

export default function AccountSettings() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const users = data.users as any[];
  const currentUserId =
    typeof window !== 'undefined'
      ? localStorage.getItem('currentUserId')
      : null;
  const parent = currentUserId ? users.find(u => u.id === currentUserId) : null;

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        アカウント設定
      </h1>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        ここでサブユーザーを作成 / 削除できます（開発モード）。
      </p>

      <div className="mb-4">
        <h2 className="text-sm font-semibold">サブユーザーを追加</h2>
        <Form method="post" className="flex gap-2 mt-2">
          <input type="hidden" name="intent" value="add-subuser" />
          <input type="hidden" name="parentId" value={currentUserId ?? ''} />
          <input
            name="name"
            className="form-input flex-1"
            placeholder="サブユーザー名"
          />
          <button className="btn-inline" type="submit">
            追加
          </button>
        </Form>
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-semibold">既存のサブユーザー</h2>
        {currentUserId ? (
          <ul className="mt-2 space-y-2">
            {parent && parent.subUsers && parent.subUsers.length > 0 ? (
              parent.subUsers.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between">
                  <div>{s.name}</div>
                  <Form method="post">
                    <input type="hidden" name="intent" value="remove-subuser" />
                    <input
                      type="hidden"
                      name="parentId"
                      value={currentUserId ?? ''}
                    />
                    <input type="hidden" name="subId" value={s.id} />
                    <button className="text-red-600">削除</button>
                  </Form>
                </li>
              ))
            ) : (
              <div className="text-xs text-gray-500">
                サブユーザーがありません。
              </div>
            )}
          </ul>
        ) : (
          <div className="text-xs text-gray-500">
            メインアカウントでログインしてください。
          </div>
        )}
      </div>

      <Link to="/me" className="text-blue-600">
        戻る
      </Link>
    </div>
  );
}
