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
        \u30ed\u30b0\u30a4\u30f3\uff08\u958b\u767a\u7528\uff09
      </h1>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        \u30e6\u30fc\u30b6\u30fc\u3092\u9078\u629e\u3059\u308b\u3068\u3001\u3053\u306e\u30d6\u30e9\u30a6\u30b6\u306b\u30ed\u30b0\u30a4\u30f3\u60c5\u5831\u304c\u4fdd\u5b58\u3055\u308c\u307e\u3059\u3002\n+
        \u4e26\u3079\u3066\u30b5\u30d6\u30e6\u30fc\u30b6\u30fc\u3082\u4f7f\u3044\u307e\u3059\u3002
      </p>
      <ul className="space-y-4">
        {users.map(u => (
          <li key={u.id}>
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  try {
                    // select the primary user identity
                    localStorage.setItem('currentUserId', u.id);
                    localStorage.setItem('currentUserName', u.name);
                    // clear any selected sub-user meta
                    localStorage.removeItem('currentSubUserId');
                    localStorage.removeItem('currentSubUserName');
                    window.location.href = '/';
                  } catch {}
                }}
                className="flex-1 text-left px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {u.name}
              </button>
            </div>

            {/* render subUsers if present */}
            {u.subUsers && u.subUsers.length > 0 && (
              <div className="mt-2 space-y-2 pl-4">
                {u.subUsers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      try {
                        // store both parent user and sub-user so app can show parent and act as sub
                        localStorage.setItem('currentUserId', u.id);
                        localStorage.setItem('currentUserName', u.name);
                        localStorage.setItem('currentSubUserId', s.id);
                        localStorage.setItem('currentSubUserName', s.name);
                        window.location.href = '/';
                      } catch {}
                    }}
                    className="w-full text-left px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
