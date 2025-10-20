import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from '~/components/ui/toaster';
import {
  GenericErrorPage,
  NotFoundPage,
  ServerErrorPage,
} from '~/components/common/ErrorPages';
import { AppError } from '~/lib/errors';

import type { Route } from './+types/root';
import './app.css';
import ResponsiveNav from './components/layout/ResponsiveNav';
import { useLoadingState } from './hooks/common/useLoadingState';
import { useViewportHeight } from './hooks/common/useViewportHeight';
import { useQueryClientConfig } from './hooks/common/useQueryClientConfig';
import { useClientOnlyDebugInfo } from './hooks/common/useClientOnlyDebugInfo';

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
    // サーバーサイド: デフォルトはライトモード（フリック防止のため）
    // 必要に応じて localStorage をシミュレートするか、クライアントサイドで初期化
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta />
          <Links />
          {/* ダークモード初期化スクリプト - 他のスクリプトより先に実行 */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    const theme = localStorage.getItem('theme') || 'system';
                    const root = document.documentElement;
                    if (theme === 'dark') {
                      root.classList.add('dark');
                    } else if (theme === 'light') {
                      root.classList.remove('dark');
                    } else {
                      // system: メディアクエリに従う
                      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                      root.classList.toggle('dark', prefersDark);
                    }
                  } catch (e) {
                    // localStorageが利用できない場合、デフォルトはライト
                  }
                })();
              `,
            }}
          />
          {/* Place Scripts in the root head during SSR so runtime does not try to
        render synchronous/defer scripts outside the main document. */}
          <Scripts />
        </head>
        <body>
          {/* Skip link for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded-md z-50"
          >
            メインコンテンツへスキップ
          </a>
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

export default function App() {
  // useNavigation is only available inside the Router context (client-side)
  const navigation = useNavigation();
  const { isLoading, loadingTimeout } = useLoadingState(navigation);
  const qc = useQueryClientConfig();

  // Set viewport height for mobile
  useViewportHeight();

  return (
    <QueryClientProvider client={qc}>
      <Layout>
        <Outlet />

        {/* Loading overlay with timeout protection */}
        {isLoading && !loadingTimeout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 pointer-events-auto">
            <div className="toast-slate">
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
          <div className="toast-blue">
            <div className="w-4 h-4 border border-t-transparent border-white rounded-full animate-spin" />
            <span>Loading...</span>
          </div>
        )}

        {/* Debug info - only in development */}
        {useClientOnlyDebugInfo(navigation, isLoading, loadingTimeout)}
      </Layout>

      {/* React Query DevTools - only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}

      {/* Toast notifications */}
      <Toaster />
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // AppError の場合
  if (error instanceof AppError) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }
    if (error.status === 500) {
      return <ServerErrorPage />;
    }
    return <GenericErrorPage status={error.status} message={error.message} />;
  }

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
