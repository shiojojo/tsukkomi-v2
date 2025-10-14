import { Link } from 'react-router';
import { Button } from '~/components/ui/Button';
import {
  ERROR_PAGE_CONTAINER,
  ICON_GRAY,
  ICON_RED,
  PAGE_CONTAINER,
  CENTERED_CONTAINER,
} from '~/styles/commonStyles';

export function NotFoundPage() {
  return (
    <main className={PAGE_CONTAINER}>
      <div className={CENTERED_CONTAINER}>
        <div className={ERROR_PAGE_CONTAINER}>
          <div className={ICON_GRAY}>
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
          <h1 className="text-2xl font-semibold text-foreground mb-2">
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
    </main>
  );
}

export function ServerErrorPage() {
  return (
    <main className={PAGE_CONTAINER}>
      <div className={CENTERED_CONTAINER}>
        <div className={ERROR_PAGE_CONTAINER}>
          <div className={ICON_RED}>
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
          <h1 className="text-2xl font-semibold text-foreground mb-2">
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
    </main>
  );
}

export function GenericErrorPage({
  status,
  message,
}: {
  status: number;
  message: string;
}) {
  return (
    <main className={PAGE_CONTAINER}>
      <div className={CENTERED_CONTAINER}>
        <div className={ERROR_PAGE_CONTAINER}>
          <div className={ICON_RED}>
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
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {status} - {message}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            エラーが発生しました。しばらく経ってから再度お試しください。
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
    </main>
  );
}
