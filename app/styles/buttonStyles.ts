/**
 * 概要: ボタンコンポーネントで使用する共通スタイル定数。
 * Intent: NumericVoteButtons などのコンポーネントで重複する Tailwind クラスを共通化し、一貫性と保守性を確保。
 * Contract: 各定数は Tailwind CSS クラス文字列。コンポーネントで直接使用。
 * Environment: ブラウザ/SSR 両対応。Tailwind が適用されている前提。
 * Errors: なし（静的定数）。
 */

export const CONTROL_BTN_BASE =
  'inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-md text-sm font-medium border';

export const CONTROL_BTN_ACTIVE = 'bg-blue-600 text-white border-blue-600';

export const CONTROL_BTN_INACTIVE =
  'bg-white text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100';

// 小サイズボタン（インライン使用）
export const SMALL_BUTTON_BASE =
  'inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-medium border shadow-sm';

export const SMALL_BUTTON_ACTIVE = 'bg-blue-600 text-white border-blue-600';

export const SMALL_BUTTON_INACTIVE =
  'bg-white text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100';

// セカンダリボタン（アウトラインスタイル）
export const SECONDARY_BUTTON =
  'inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50';

// ターシャリボタン（グレー背景）
export const TERTIARY_BUTTON =
  'text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700';

// ロードモアボタン
export const LOAD_MORE_BUTTON =
  'px-4 py-2 rounded-md border bg-white disabled:opacity-50 mb-4';

// 破壊的ボタン（削除など）
export const DESTRUCTIVE_BUTTON = 'text-sm text-red-600 hover:text-red-800';

// アイコンボタン（FavoriteButton 用）
export const ICON_BUTTON_BASE = 'p-2 rounded-md hover:opacity-90';

export const ICON_BUTTON_ACTIVE = 'text-red-500';

export const ICON_BUTTON_INACTIVE = 'text-gray-400 dark:text-white';