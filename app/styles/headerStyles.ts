/**
 * 概要: ヘッダーコンポーネントで使用する共通スタイル定数。
 * Intent: StickyHeaderLayout などのコンポーネントで重複する Tailwind クラスを共通化し、一貫性と保守性を確保。
 * Contract: 各定数は Tailwind CSS クラス文字列。コンポーネントで直接使用。
 * Environment: ブラウザ/SSR 両対応。Tailwind が適用されている前提。
 * Errors: なし（静的定数）。
 */

export const HEADER_BASE =
  'z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800';