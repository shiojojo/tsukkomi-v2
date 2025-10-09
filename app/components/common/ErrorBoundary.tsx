import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isRouteErrorResponse } from 'react-router';
import { Button } from '~/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.state.errorInfo!);
      }

      return (
        <DefaultErrorFallback
          error={this.state.error!}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  showDetails?: boolean;
}

function DefaultErrorFallback({
  error,
  showDetails = false,
}: DefaultErrorFallbackProps) {
  let message = 'エラーが発生しました';
  let details = '予期しないエラーが発生しました。';

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? 'ページが見つかりません' : 'エラー';
    details =
      error.status === 404
        ? 'お探しのページは存在しないか、移動した可能性があります。'
        : error.statusText || details;
  } else if (error instanceof Error) {
    details = error.message;
  }

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

        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {message}
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">{details}</p>

        {showDetails && error instanceof Error && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              エラー詳細 (開発者向け)
            </summary>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto max-h-40">
              <code>{error.stack}</code>
            </pre>
          </details>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => window.location.reload()}
            variant="control"
            className="px-3 py-2 text-sm"
          >
            ページを再読み込み
          </Button>
          <Button
            onClick={() => window.history.back()}
            variant="small"
            className="px-3 py-2 text-sm"
          >
            戻る
          </Button>
        </div>
      </div>
    </div>
  );
}
