/**
 * 概要: 開発環境でのみログを出力するロギングユーティリティ。
 * Intent: 本番環境でデバッグログが表示されることを防ぎ、開発時のデバッグ効率を向上させる。
 * Contract:
 *   - 開発環境 (import.meta.env.DEV) でのみ console.log/debug/info を実行
 *   - 本番環境では何もしない（no-op）
 * Environment:
 *   - dev: 通常の console メソッドを実行
 *   - prod: 何もしない
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * 開発環境でのみ console.log を実行
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * 開発環境でのみ console.debug を実行
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * 開発環境でのみ console.info を実行
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * 開発環境でのみ console.warn を実行
   */
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * エラーログは本番環境でも出力（重要なエラーのため）
   */
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
