import { useState, useEffect } from 'react';
import type { Navigation } from 'react-router';

export function useLoadingState(navigation: Navigation) {
  const isLoading = navigation.state !== 'idle';
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const navigationPathname = navigation.location?.pathname ?? null;
  const navigationSearch = navigation.location?.search ?? '';
  const navigationFormMethod = navigation.formMethod
    ? navigation.formMethod.toUpperCase()
    : null;

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

  return { isLoading, loadingTimeout };
}