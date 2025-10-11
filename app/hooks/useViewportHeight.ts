import { useEffect } from 'react';

export function useViewportHeight() {
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
}