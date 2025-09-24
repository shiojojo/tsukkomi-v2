import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
} from 'react-router';
import { useEffect } from 'react';

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
      {/* Note: temporarily removed ResponsiveNav and ScrollRestoration on client
          to isolate a script-injection warning source. Reintroduce after
          debugging. */}
    </>
  );
}

export default function App() {
  // useNavigation is only available inside the Router context (client-side)
  const navigation = useNavigation();
  const isLoading = navigation.state !== 'idle';
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
    <Layout>
      <Outlet />

      {/* Loading overlay rendered at the top level so it covers route content */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-slate-900/95 text-white rounded-lg p-4 flex items-center gap-3">
            <div className="w-8 h-8 border-4 border-t-transparent border-white rounded-full animate-spin" />
            <div className="text-sm">Loading…</div>
          </div>
        </div>
      )}
    </Layout>
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
