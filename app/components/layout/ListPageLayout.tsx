import type { ReactNode, RefObject } from 'react';
import StickyHeaderLayout from './StickyHeaderLayout';
import { HEADER_BASE } from '~/styles/headerStyles';

interface ListPageLayoutProps {
  headerTitle: string;
  filters: ReactNode;
  list: ReactNode;
  pagination?: ReactNode;
  contentRef?: RefObject<HTMLDivElement | null>;
  extraContent?: ReactNode;
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
  extraContent,
}: ListPageLayoutProps) {
  const header = (
    <div className={`${HEADER_BASE}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{headerTitle}</h1>
        </div>
      </div>
      {filters}
    </div>
  );

  return (
    <StickyHeaderLayout header={header} contentRef={contentRef}>
      {extraContent}
      {list}
      {pagination}
    </StickyHeaderLayout>
  );
}
