/**
 * アプリケーション全体で使用する定数
 */

/**
 * デフォルトのページサイズ
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * コメントカウントクエリのオプション
 * リアルタイム性を確保するための設定
 */
export const COMMENT_COUNTS_QUERY_OPTIONS = {
  staleTime: 30 * 1000, // 30 seconds - refresh comment counts periodically
  refetchInterval: 60 * 1000, // Refetch every minute to keep counts updated
} as const;