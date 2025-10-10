import { Link } from 'react-router';
import { Button } from '~/components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-.98-5.5-2.5m.5-4C6.19 8.98 4.24 9 2 9s-4.19-.02-4.5-.5m.5-4C6.19 4.98 4.24 4 2 4s-4.19.02-4.5.5"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          404 - ページが見つかりません
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          お探しのページは存在しないか、移動した可能性があります。
        </p>

        <div className="flex gap-3 justify-center">
          <Link to="/">
            <Button variant="control">ホームに戻る</Button>
          </Link>
          <Button onClick={() => window.history.back()} variant="small">
            戻る
          </Button>
        </div>
      </div>
    </div>
  );
}
