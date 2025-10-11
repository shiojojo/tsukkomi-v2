/**
 * 概要: アプリケーション全体で使用する共通スタイル定数。
 * Intent: 重複する Tailwind CSS クラスを共通化し、一貫性と保守性を確保。
 * Contract: 各定数は Tailwind CSS クラス文字列。コンポーネントで直接使用。
 * Environment: ブラウザ/SSR 両対応。Tailwind が適用されている前提。
 * Errors: なし（静的定数）。
 */

// エラーページの共通コンテナスタイル
export const ERROR_PAGE_CONTAINER =
  'max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 text-center';

// ボタンの共通スタイル
export const BUTTON_BASE = 'px-4 py-2 rounded font-medium transition-colors';
export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-blue-500 text-white hover:bg-blue-600`;
export const BUTTON_SECONDARY = `${BUTTON_BASE} bg-gray-500 text-white hover:bg-gray-600`;

// フォーム入力の共通スタイル
export const FORM_INPUT =
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500';

// バッジ/タグの共通スタイル
export const BADGE_BASE = 'inline-flex items-center rounded-full px-2 py-1 font-semibold text-xs';
export const BADGE_DEFAULT = `${BADGE_BASE} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-200`;
export const BADGE_BLUE = `${BADGE_BASE} bg-blue-50 dark:bg-blue-700 text-blue-700 dark:text-white`;

// カードの共通スタイル
export const CARD_BASE = 'bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4';

// トースト/通知の共通スタイル
export const TOAST_BASE = 'fixed z-40 rounded-lg p-4 flex items-center gap-3 shadow-lg';
export const TOAST_BLACK = `${TOAST_BASE} bg-black text-white text-xs`;
export const TOAST_SLATE = `${TOAST_BASE} bg-slate-900/95 text-white`;
export const TOAST_BLUE = 'fixed top-4 right-4 z-40 bg-blue-500 text-white text-sm px-3 py-2 rounded-lg shadow-lg flex items-center gap-2';

// アイコンの共通スタイル
export const ICON_BUTTON = 'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center';
export const ICON_GRAY = `${ICON_BUTTON} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`;
export const ICON_RED = `${ICON_BUTTON} bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400`;

// レイアウトの共通スタイル
export const PAGE_CONTAINER = 'pt-16 p-4 container mx-auto';
export const CENTERED_CONTAINER = 'min-h-[400px] flex items-center justify-center';