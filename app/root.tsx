import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
  type Navigation,
} from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { Toaster } from '~/components/ui/toaster';

import type { Route } from './+types/root';
import './app.css';
import ResponsiveNav from './components/layout/ResponsiveNav';

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // Render the full HTML document only on the server (where `document` is undefined).
  // On the client, returning a fragment prevents React from attempting to mount
  // another <html>/<head>/<body> into the existing document which can cause
  // DOM removeChild errors during hydration and navigation.
  if (typeof document === 'undefined') {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta />
          <Links />
          {/* Place Scripts in the root head during SSR so runtime does not try to
        render synchronous/defer scripts outside the main document. */}
          <Scripts />
        </head>
        <body>
          {children}
          {/* Responsive nav: footer on mobile, header on md+ */}
          <ResponsiveNav />
          <ScrollRestoration />
        </body>
      </html>
    );
  }

  // Client: render children and global UI elements without recreating the
  // document element. This avoids DOM mismatches when React hydrates into the
  // existing document (hydrateRoot(document, ...)).
  return (
    <>
      {children}
      <ResponsiveNav />
      {/* Note: ScrollRestoration は script を生成し React 19 の hoist 制約により
          クライアント側 fragment 直下では警告を出すため SSR ドキュメント側のみ設置 */}
    </>
  );
}

// Client-only component to avoid hydration mismatches
function ClientOnlyDebugInfo({
  navigation,
  isLoading,
  loadingTimeout,
}: {
  navigation: Navigation;
  isLoading: boolean;
  loadingTimeout: boolean;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-black text-white text-xs p-2 rounded font-mono">
      <div>Nav: {navigation.state}</div>
      <div>Loading: {isLoading ? 'YES' : 'NO'}</div>
      <div>Timeout: {loadingTimeout ? 'YES' : 'NO'}</div>
      {navigation.location && <div>To: {navigation.location.pathname}</div>}
    </div>
  );
}

export default function App() {
  // useNavigation is only available inside the Router context (client-side)
  const navigation = useNavigation();
  const isLoading = navigation.state !== 'idle';
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const navigationPathname = navigation.location?.pathname ?? null;
  const navigationSearch = navigation.location?.search ?? '';
  const navigationFormMethod = navigation.formMethod
    ? navigation.formMethod.toUpperCase()
    : null;

  // Debug navigation state - client-side only
  useEffect(() => {
    console.log('Navigation state:', navigation.state, 'isLoading:', isLoading);
  }, [navigation.state, isLoading]);

  // Add timeout for loading state to prevent permanent loading overlay.
  // Answer searches can take longer due to keyword and score filters, so we
  // allow additional time before falling back to the non-blocking indicator.
  useEffect(() => {
    if (!isLoading) {
      setLoadingTimeout(false);
      return;
    }

    if (typeof window === 'undefined') {
      setLoadingTimeout(false);
      return;
    }

    setLoadingTimeout(false);

    const hasQueryString = navigationSearch.length > 0;
    const isAnswerSearchNavigation =
      navigationPathname === '/answers' && hasQueryString;

    const baseTimeout =
      navigationFormMethod && navigationFormMethod !== 'GET' ? 7000 : 5000;

    const timeoutMs = (() => {
      if (isAnswerSearchNavigation) return 15000;
      if (navigationFormMethod === 'GET' && hasQueryString) return 10000;
      return baseTimeout;
    })();

    const timer = window.setTimeout(() => {
      console.warn(
        `Loading state timeout (${timeoutMs}ms) - switching to non-blocking indicator`
      );
      setLoadingTimeout(true);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [isLoading, navigationFormMethod, navigationPathname, navigationSearch]);

  // QueryClient per app instance (client-side). Keep it lazy so SSR doesn't create one.
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              // 認証エラーはリトライしない
              if (error instanceof Response && error.status === 401)
                return false;
              // サーバーエラーは3回までリトライ
              return failureCount < 3;
            },
            staleTime: 5 * 60 * 1000, // 5分
          },
          mutations: {
            onError: error => {
              // グローバルエラーハンドリング
              console.error('Mutation error:', error);
              // トースト表示（後述）
            },
          },
        },
      })
  );

  // Set CSS --vh to handle mobile browser UI changes (iOS address bar, safe
  // viewport). This ensures containers using `calc(var(--vh,1vh) * 100)` map
  // to the true visual viewport height and prevents outer page scrolling on
  // small devices like iPhone SE.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Debounced setter to avoid thrash during scroll/resize.
    let rafId: number | null = null;
    const setVh = () => {
      try {
        const vv = window.visualViewport;
        const vh =
          vv && typeof vv.height === 'number' ? vv.height : window.innerHeight;
        document.documentElement.style.setProperty(
          '--vh',
          String(vh / 100) + 'px'
        );
      } catch {}
    };

    const schedule = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setVh();
        rafId = null;
      });
    };

    // Initial set
    setVh();

    // Common events that may change viewport height on mobile
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('pageshow', schedule);
    window.addEventListener('visibilitychange', schedule);

    const vv = window.visualViewport;
    if (vv && typeof vv.addEventListener === 'function') {
      vv.addEventListener('resize', schedule);
      vv.addEventListener('scroll', schedule);
    }

    return () => {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('pageshow', schedule);
      window.removeEventListener('visibilitychange', schedule);
      if (vv && typeof vv.removeEventListener === 'function') {
        vv.removeEventListener('resize', schedule);
        vv.removeEventListener('scroll', schedule);
      }
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <QueryClientProvider client={qc}>
      <Layout>
        <Outlet />

        {/* Loading overlay with timeout protection */}
        {isLoading && !loadingTimeout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 pointer-events-auto">
            <div className="bg-slate-900/95 text-white rounded-lg p-4 flex items-center gap-3 shadow-lg">
              <div className="w-6 h-6 border-2 border-t-transparent border-white rounded-full animate-spin" />
              <div className="text-sm font-medium">
                {navigation.state === 'loading' &&
                  'ページを読み込んでいます...'}
                {navigation.state === 'submitting' &&
                  'データを送信しています...'}
                {navigation.state !== 'loading' &&
                  navigation.state !== 'submitting' &&
                  'Loading...'}
              </div>
            </div>
          </div>
        )}

        {/* Loading timeout fallback - shows a less intrusive loading indicator */}
        {isLoading && loadingTimeout && (
          <div className="fixed top-4 right-4 z-40 bg-blue-500 text-white text-sm px-3 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <div className="w-4 h-4 border border-t-transparent border-white rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        )}

        {/* Debug info - only in development */}
        <ClientOnlyDebugInfo
          navigation={navigation}
          isLoading={isLoading}
          loadingTimeout={loadingTimeout}
        />
      </Layout>

      {/* React Query DevTools - only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}

      {/* Toast notifications */}
      <Toaster />
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }
    if (error.status === 500) {
      return <ServerErrorPage />;
    }
    return (
      <GenericErrorPage status={error.status} message={error.statusText} />
    );
  }

  // 予期せぬエラー
  return (
    <GenericErrorPage status={500} message="予期せぬエラーが発生しました" />
  );
}

// 専用エラーページコンポーネント
function NotFoundPage() {
  return (
    <main className="pt-16 p-4 container mx-auto">
      <div className="min-h-[400px] flex items-center justify-center">
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
            <a
              href="/"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              ホームに戻る
            </a>
            <button
              onClick={() => window.history.back()}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              戻る
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function ServerErrorPage() {
  return (
    <main className="pt-16 p-4 container mx-auto">
      <div className="min-h-[400px] flex items-center justify-center">
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
            <a
              href="/"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              ホームに戻る
            </a>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              ページを再読み込み
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function GenericErrorPage({
  status,
  message,
}: {
  status: number;
  message: string;
}) {
  return (
    <main className="pt-16 p-4 container mx-auto">
      <div className="min-h-[400px] flex items-center justify-center">
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
            {status} - {message}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            エラーが発生しました。しばらく経ってから再度お試しください。
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              ホームに戻る
            </a>
            <button
              onClick={() => window.history.back()}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              戻る
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
