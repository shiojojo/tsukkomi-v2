import { useEffect, useRef } from 'react';

/**
 * カスタムフック: ページ変更時にスクロール位置をリセットする
 * @param currentPage 現在のページ番号
 * @returns containerRef スクロールコンテナのref
 */
export function useScrollReset(currentPage: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const el = containerRef.current;
      if (el) {
        el.scrollTop = 0;
        try {
          el.scrollTo?.({ top: 0, behavior: 'auto' });
        } catch {}
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    } catch {}
  }, [currentPage]);

  return containerRef;
}