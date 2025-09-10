import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { getUsers } from '~/lib/db';

export async function loader(_args: LoaderFunctionArgs) {
  const users = await getUsers();
  return { users };
}

export default function LoginRoute() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const users = data.users;

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        ログイン（開発用）
      </h1>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        ユーザーを選択すると、このブラウザにログイン情報が保存されます。表示される名前で操作が行われます。
      </p>
      <ul className="space-y-2">
        {users.map(u => (
          <li key={u.id}>
            <button
              onClick={() => {
                try {
                  localStorage.setItem('currentUserId', u.id);
                  localStorage.setItem('currentUserName', u.name);
                  // quick feedback: navigate back
                  window.location.href = '/';
                } catch {
                  // noop
                }
              }}
              className="w-full text-left px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {u.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
