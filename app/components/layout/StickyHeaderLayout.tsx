import { useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useBrowserDetection } from '~/hooks/common/useBrowserDetection';

/**
 * スクロール方向を検知するカスタムフック（速度考慮）
 */
function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const [lastScrollY, setLastScrollY] = useState(0);
  const [lastScrollTime, setLastScrollTime] = useState(Date.now());

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const currentTime = Date.now();
      const timeDiff = currentTime - lastScrollTime;
      const scrollDiff = Math.abs(currentScrollY - lastScrollY);
      const velocity = scrollDiff / timeDiff; // px/ms

      // 一番上に戻った時は常にヘッダーを表示
      if (currentScrollY <= 10) {
        setScrollDirection('up');
        setLastScrollY(currentScrollY);
        setLastScrollTime(currentTime);
        return;
      }

      // 下スクロール（ヘッダー隠す）は敏感に、上スクロール（ヘッダー表示）はより強い条件で
      const shouldUpdateDirection =
        currentScrollY > lastScrollY
          ? velocity > 0.3 || scrollDiff > 10 // 下スクロール: 敏感
          : velocity > 3; // 上スクロール: より強い条件

      if (shouldUpdateDirection) {
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setScrollDirection('down');
        } else if (currentScrollY < lastScrollY) {
          setScrollDirection('up');
        }
      }

      setLastScrollY(currentScrollY);
      setLastScrollTime(currentTime);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, lastScrollTime]);

  return scrollDirection;
}

/**
 * StickyHeaderLayout
 *
 * Purpose: provide a consistent two-row layout where the header lives in an
 * auto-sized row and the content area is a scrollable 1fr row. The header is
 * sticky and positioned below a top app header offset variable.
 *
 * Props:
 *  - header: ReactNode (header content)
 *  - children: ReactNode (scrollable content)
 *  - className: optional extra classes for outer container
 */
export default function StickyHeaderLayout({
  header,
  children,
  className = '',
  contentRef,
}: {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  contentRef?: RefObject<HTMLDivElement | null>;
}) {
  const useDocumentScroll = useBrowserDetection();
  const scrollDirection = useScrollDirection();

  if (useDocumentScroll) {
    return (
      <div
        style={{
          minHeight: 'calc(var(--vh, 1vh) * 100)',
        }}
        className={`p-4 max-w-3xl mx-auto min-w-0 ${className}`}
      >
        {/* Chrome on Android only hides its browser chrome when the root document scrolls.
            In that environment we let the page scroll normally and keep the header sticky
            instead of relying on an inner overflow container. */}
        <div
          className={`sticky bg-white dark:bg-black rounded-lg p-4 shadow-sm transition-transform duration-300 ease-in-out ${
            scrollDirection === 'down' ? '-translate-y-full' : 'translate-y-0'
          }`}
          style={{
            top: 0,
            paddingTop: 'var(--app-header-height, 0px)',
            zIndex: 30,
          }}
        >
          {header}
        </div>

        <div
          ref={contentRef}
          className="mt-2 pb-20 sm:pb-28 min-w-0"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)',
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    // Grid layout: header gets its intrinsic height (auto) and the second
    // row fills the remaining viewport space. The content row is the only
    // scrolling element (overflow-auto), so the header never overlaps the
    // content and behavior is consistent across browsers/devices.
    <div
      // use --vh to avoid mobile browser UI resize quirks (iOS address bar)
      style={{
        height: 'calc(var(--vh, 1vh) * 100)',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
      }}
      className={`p-4 max-w-3xl mx-auto overflow-hidden overflow-x-hidden grid min-w-0 ${className}`}
    >
      {/* Header row (in normal flow) */}
      <div
        style={{ paddingTop: 'var(--app-header-height, 0px)', zIndex: 30 }}
        className="bg-white dark:bg-black rounded-lg p-4 shadow-sm"
      >
        {header}
      </div>

      {/* Content row: this is the scroll container. Use min-h-0 to allow
          the child to shrink correctly in grid/flex layouts. */}
      <div
        ref={contentRef}
        className="mt-2 overflow-auto pb-20 sm:pb-28 min-w-0"
        style={
          {
            minHeight: 0,
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)',
            // Contain overscroll so the outer document doesn't start scrolling
            // when the inner content is at its edges (helps on iOS Safari)
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}
