import { Link } from 'react-router';
import { Button } from '~/components/ui/Button';

export default function ServerError() {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          500 - サーバーエラー
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          サーバーで問題が発生しました。しばらく経ってから再度お試しください。
        </p>

        <div className="flex gap-3 justify-center">
          <Link to="/">
            <Button variant="control">ホームに戻る</Button>
          </Link>
          <Button onClick={() => window.location.reload()} variant="small">
            ページを再読み込み
          </Button>
        </div>
      </div>
    </div>
  );
}
