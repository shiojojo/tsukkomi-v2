import {
  parseAnswersFilterParams,
  parseCommonFilterParams,
  parsePaginationParams,
  type QuerySource,
} from '~/lib/queryParser';
import { getTopicsPaged, searchAnswers } from '~/lib/db';

function serializeLoaderError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : undefined,
      message: typeof record.message === 'string' ? record.message : String(error),
      code: typeof record.code === 'string' ? record.code : undefined,
      details: typeof record.details === 'string' ? record.details : undefined,
      hint: typeof record.hint === 'string' ? record.hint : undefined,
    };
  }

  return {
    message: String(error),
  };
}

/**
 * 概要: リストページの loader を共通化するためのヘルパー関数。
 * Contract:
 *   - Input: entityType ('topics' | 'answers'), request (Request), extraParams (optional)
 *   - Output: JSON response with data, pagination, and filters
 * Environment: サーバーサイドのみ。db.ts 関数を呼び出す。
 * Errors: DBエラー時は throw（呼び出し側 loader が捕捉）。
 */
export async function createListLoader(
  entityType: 'topics' | 'answers',
  request: Request,
  extraParams?: Record<string, unknown>,
  querySource: QuerySource = request
): Promise<Response> {
  const { page, pageSize } = parsePaginationParams(querySource);

  let data;
  let filters;
  try {
    if (entityType === 'topics') {
      filters = parseCommonFilterParams(querySource);
      data = await getTopicsPaged({ page, pageSize, ...filters });
    } else {
      filters = parseAnswersFilterParams(querySource);
      data = await searchAnswers({ page, pageSize, ...filters, ...extraParams });
    }
  } catch (error) {
    const errorInfo = serializeLoaderError(error);

    console.error('createListLoader failed', {
      entityType,
      page,
      pageSize,
      filters,
      extraParamKeys: extraParams ? Object.keys(extraParams) : [],
      error: errorInfo,
    });

    return Response.json(
      {
        error: errorInfo.message,
        code: errorInfo.code ?? 'LIST_LOADER_FAILED',
        entityType,
      },
      { status: 500 }
    );
  }

  return Response.json({ ...data, page, pageSize, ...filters });
}
