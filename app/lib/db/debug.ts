import { logger } from '../logger';

/**
 * withTiming
 * Intent: DB 関数の実行時間を測定し、開発環境でログ出力するラッパー。
 * Contract: 非同期関数を受け取り、同じシグネチャの関数を返す。実行時間をログに記録。
 * Environment: 開発環境のみログ出力。本番ではオーバーヘッドなし。
 */
export function withTiming<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  functionName: string,
  queryName?: string
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    const start = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      logger.debug(`${functionName} executed in ${duration}ms`, {
        query: queryName || 'unknown',
        duration,
        args: import.meta.env.DEV ? args : undefined, // 開発時のみ引数をログ
      });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`${functionName} failed after ${duration}ms`, {
        query: queryName || 'unknown',
        duration,
        error: String(error),
      });
      throw error;
    }
  };
}