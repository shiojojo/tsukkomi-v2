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
      <h1 className="text-xl font-bold mb-4">ログイン（開発用）</h1>
      <p className="text-sm text-gray-600 mb-4">
        ユーザーを選択して localStorage に設定します。
      </p>
      <ul className="space-y-2">
        {users.map(u => (
          <li key={u.id}>
            <button
              onClick={() => {
                try {
                  localStorage.setItem('currentUserId', u.id);
                  // quick feedback: navigate back
                  window.location.href = '/';
                } catch {
                  // noop
                }
              }}
              className="w-full text-left px-3 py-2 rounded bg-white border hover:bg-gray-50"
            >
              {u.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
