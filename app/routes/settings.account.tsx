import { Link } from 'react-router';

export default function AccountSettings() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        アカウント設定
      </h1>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        ここで将来的にユーザー設定を編集できます。
      </p>
      <Link to="/me" className="text-blue-600">
        戻る
      </Link>
    </div>
  );
}
