import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import { mockUsers } from '~/mock/users';

export default function MeRoute() {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    try {
      // show currently selected sub-user if set, otherwise primary user
      setId(
        localStorage.getItem('currentSubUserId') ??
          localStorage.getItem('currentUserId')
      );
      setName(
        localStorage.getItem('currentSubUserName') ??
          localStorage.getItem('currentUserName')
      );
    } catch {
      setId(null);
      setName(null);
    }
  }, []);

  if (!id) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          ログインされていません。
        </p>
        <Link to="/login" className="text-blue-600">
          ログインへ
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        {name}
      </h1>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        ユーザーID: {id}
      </p>
      {/* Sub-user switcher for parent account when available */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold mb-2">サブユーザー切替</h2>
        {(() => {
          try {
            const parentId = localStorage.getItem('currentUserId');
            if (!parentId)
              return (
                <div className="text-xs text-gray-500">
                  メインアカウントでログインしてください。
                </div>
              );
            const parent = mockUsers.find(u => u.id === parentId);
            if (!parent || !parent.subUsers)
              return (
                <div className="text-xs text-gray-500">
                  サブユーザーがありません。
                </div>
              );
            return (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    try {
                      // clear sub-user selection (back to primary identity)
                      localStorage.removeItem('currentSubUserId');
                      localStorage.removeItem('currentSubUserName');
                      // ensure primary is set
                      localStorage.setItem('currentUserId', parent.id);
                      localStorage.setItem('currentUserName', parent.name);
                      window.location.reload();
                    } catch {}
                  }}
                  className="w-full text-left px-3 py-2 rounded bg-white border"
                >
                  メインとして操作 ({parent.name})
                </button>
                {parent.subUsers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      try {
                        localStorage.setItem('currentUserId', parent.id);
                        localStorage.setItem('currentUserName', parent.name);
                        localStorage.setItem('currentSubUserId', s.id);
                        localStorage.setItem('currentSubUserName', s.name);
                        window.location.reload();
                      } catch {}
                    }}
                    className="w-full text-left px-3 py-2 rounded bg-gray-100"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            );
          } catch {
            return (
              <div className="text-xs text-gray-500">
                サブユーザー情報を取得できませんでした。
              </div>
            );
          }
        })()}
      </div>
      <div className="space-y-2">
        <Link
          to="/settings/account"
          className="block px-3 py-2 bg-white dark:bg-gray-800 border rounded text-gray-900 dark:text-gray-100"
        >
          アカウント設定
        </Link>
        <button
          onClick={() => {
            try {
              localStorage.removeItem('currentUserId');
              localStorage.removeItem('currentUserName');
              // also clear any selected sub-user
              localStorage.removeItem('currentSubUserId');
              localStorage.removeItem('currentSubUserName');
              window.location.href = '/';
            } catch {}
          }}
          className="block px-3 py-2 w-full text-left bg-red-600 text-white rounded"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
