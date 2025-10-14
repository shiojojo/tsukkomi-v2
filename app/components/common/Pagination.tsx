import { Link } from 'react-router';

type PaginationProps = {
  currentPage: number;
  pageCount: number;
  buildHref: (page: number) => string;
  className?: string;
};

/**
 * 概要: ページネーションUIを提供する共通コンポーネント。
 * Intent: モバイル版（前へ/次へボタン）とデスクトップ版（数値リンク）をレスポンシブに表示。
 * Contract:
 *   - currentPage: 現在のページ番号（1-based）
 *   - pageCount: 総ページ数
 *   - buildHref: ページ番号を受け取り、クエリパラメータを保持したURLを返す関数
 *   - className: 追加のCSSクラス（オプション）
 * Environment: ブラウザ専用（Linkコンポーネント使用）
 * Errors: pageCount <= 1 の場合は何も表示しない
 */
export function Pagination({
  currentPage,
  pageCount,
  buildHref,
  className = '',
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const windowSize = 3;
  const start = Math.max(1, currentPage - windowSize);
  const end = Math.min(pageCount, currentPage + windowSize);

  return (
    <>
      {/* Mobile pagination controls */}
      <div
        className={`flex items-center justify-between mt-4 md:hidden ${className}`}
      >
        <Link
          to={buildHref(Math.max(1, currentPage - 1))}
          aria-label="前のページ"
          className={`px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${
            currentPage <= 1 ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          前へ
        </Link>
        <div className="text-sm text-muted-foreground">{`ページ ${currentPage} / ${pageCount}`}</div>
        <Link
          to={buildHref(Math.min(pageCount, currentPage + 1))}
          aria-label="次のページ"
          className={`px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${
            currentPage >= pageCount ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          次へ
        </Link>
      </div>

      {/* Desktop pagination controls */}
      <div
        className={`hidden md:flex items-center justify-center mt-4 gap-2 ${className}`}
      >
        <nav aria-label="ページネーション" className="flex items-center gap-2">
          <Link
            to={buildHref(Math.max(1, currentPage - 1))}
            aria-label="前のページ"
            className={`px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${
              currentPage <= 1 ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            前へ
          </Link>

          <div className="flex items-center gap-1">
            {start > 1 && (
              <>
                <Link
                  to={buildHref(1)}
                  className="px-3 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  1
                </Link>
                {start > 2 && (
                  <span className="px-2 text-muted-foreground">…</span>
                )}
              </>
            )}

            {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(
              p => (
                <Link
                  key={p}
                  to={buildHref(p)}
                  aria-current={p === currentPage ? 'page' : undefined}
                  className={`px-3 py-2 rounded-md border transition-all ${
                    p === currentPage
                      ? 'bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/20 font-semibold scale-105'
                      : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm'
                  }`}
                >
                  {p}
                </Link>
              )
            )}

            {end < pageCount && (
              <>
                {end < pageCount - 1 && (
                  <span className="px-2 text-muted-foreground">…</span>
                )}
                <Link
                  to={buildHref(pageCount)}
                  className="px-3 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {pageCount}
                </Link>
              </>
            )}
          </div>

          <Link
            to={buildHref(Math.min(pageCount, currentPage + 1))}
            aria-label="次のページ"
            className={`px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${
              currentPage >= pageCount ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            次へ
          </Link>
        </nav>
      </div>
    </>
  );
}
