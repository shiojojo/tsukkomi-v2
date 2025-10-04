import type { ReactNode, RefObject } from 'react';
import StickyHeaderLayout from '~/components/StickyHeaderLayout';

interface ListPageLayoutProps {
  headerTitle: string;
  filters: ReactNode;
  list: ReactNode;
  pagination?: ReactNode;
  contentRef?: RefObject<HTMLDivElement | null>;
}

/**
 * 概要: リストページの共通レイアウトを提供するコンポーネント。
 * Intent: フィルタ、リスト、ページネーションを統一したレイアウトで表示。
 * Contract:
 *   - headerTitle: ページヘッダータイトル（string）
 *   - filters: フィルタUI（ReactNode）
 *   - list: リストコンテンツ（ReactNode）
 *   - pagination: ページネーション（オプション、ReactNode）
 *   - contentRef: コンテンツのref（オプション、RefObject<HTMLDivElement>）
 * Environment: ブラウザ専用
 * Errors: なし
 */
export function ListPageLayout({
  headerTitle,
  filters,
  list,
  pagination,
  contentRef,
}: ListPageLayoutProps) {
  const header = (
    <div className="z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{headerTitle}</h1>
          </div>
        </div>
        {filters}
      </div>
    </div>
  );

  return (
    <StickyHeaderLayout header={header} contentRef={contentRef}>
      {list}
      {pagination}
    </StickyHeaderLayout>
  );
}
