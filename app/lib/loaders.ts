import { parsePaginationParams, parseFilterParams } from '~/lib/queryParser';
import { getTopicsPaged, searchAnswers } from '~/lib/db';

/**
 * 概要: リストページの loader を共通化するためのヘルパー関数。
 * Contract:
 *   - Input: entityType ('topics' | 'answers'), request (Request), extraParams (optional)
 *   - Output: JSON response with data, pagination, and filters
 * Environment: サーバーサイドのみ。db.ts 関数を呼び出す。
 * Errors: DBエラー時は throw（呼び出し側 loader が捕捉）。
 */
export async function createListLoader(entityType: 'topics' | 'answers', request: Request, extraParams?: Record<string, any>) {
  const { page, pageSize } = parsePaginationParams(request);
  const filters = parseFilterParams(request, entityType);

  const data = entityType === 'topics'
    ? await getTopicsPaged({ page, pageSize, ...filters })
    : await searchAnswers({ page, pageSize, ...filters, ...extraParams });

  return { ...data, page, pageSize, ...filters };
}