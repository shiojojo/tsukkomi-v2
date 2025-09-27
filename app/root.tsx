import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { useEffect } from 'react';
import { logger } from '~/lib/logger';

import type { Route } from './+types/root';
import './app.css';
import ResponsiveNav from './components/ResponsiveNav';

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
  navigation: any;
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
    logger.log('Navigation state:', navigation.state, 'isLoading:', isLoading);
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
  const [qc] = useState(() => new QueryClient());

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
        const vv = (window as any).visualViewport;
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

    const vv = (window as any).visualViewport;
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
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
