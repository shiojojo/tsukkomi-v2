import { Link } from 'react-router';
import { useEffect, useState } from 'react';

export default function MeRoute() {
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    try {
      setId(localStorage.getItem('currentUserId'));
      setName(localStorage.getItem('currentUserName'));
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
