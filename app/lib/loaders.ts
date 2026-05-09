import { parsePaginationParams, parseFilterParams } from '~/lib/queryParser';
import { getTopicsPaged, searchAnswers } from '~/lib/db';
import { getSupabaseConfigStatus } from '~/lib/supabase';

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
export async function createListLoader(entityType: 'topics' | 'answers', request: Request, extraParams?: Record<string, unknown>): Promise<Response> {
  const { page, pageSize } = parsePaginationParams(request);
  const filters = parseFilterParams(request, entityType);

  let data;
  try {
    data = entityType === 'topics'
      ? await getTopicsPaged({ page, pageSize, ...filters })
      : await searchAnswers({ page, pageSize, ...filters, ...extraParams });
  } catch (error) {
    const errorInfo = serializeLoaderError(error);
    const supabase = getSupabaseConfigStatus();

    console.error('createListLoader failed', {
      entityType,
      page,
      pageSize,
      filters,
      extraParamKeys: extraParams ? Object.keys(extraParams) : [],
      error: errorInfo,
      supabase,
    });

    return Response.json(
      {
        error: errorInfo.message,
        code: errorInfo.code ?? 'LIST_LOADER_FAILED',
        entityType,
        supabase,
      },
      { status: 500 }
    );
  }

  return Response.json({ ...data, page, pageSize, ...filters });
}
