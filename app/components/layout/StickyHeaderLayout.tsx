import { useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useBrowserDetection } from '~/hooks/common/useBrowserDetection';

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
          className="sticky"
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
      <div style={{ paddingTop: 'var(--app-header-height, 0px)', zIndex: 30 }}>
        {header}
      </div>

      {/* Content row: this is the scroll container. Use min-h-0 to allow
          the child to shrink correctly in grid/flex layouts. */}
      <div
        ref={contentRef}
        className="mt-2 overflow-auto pb-20 sm:pb-28 min-w-0"
        style={{
          minHeight: 0,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)',
          // Contain overscroll so the outer document doesn't start scrolling
          // when the inner content is at its edges (helps on iOS Safari)
          overscrollBehavior: 'contain' as any,
          WebkitOverflowScrolling: 'touch' as any,
        }}
      >
        {children}
      </div>
    </div>
  );
}
