import { parsePaginationParams, parseFilterParams } from '~/lib/queryParser';
import { getTopicsPaged, searchAnswers, getTopics, getCommentsForAnswers, getUsers, getUserAnswerData, getFavoriteCounts } from '~/lib/db';
import { mergeUserDataIntoAnswers } from '~/lib/utils/dataMerging';
import type { Answer } from '~/lib/schemas/answer';

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

/**
 * 概要: answersリストページのloaderを共通化。topics, users, comments, user data, fav countsを含む。
 * Contract:
 *   - Input: request (Request), extraParams (optional, e.g. { topicId })
 *   - Output: 完全なloaderデータ（answers, topicsById, commentsByAnswer, etc.）
 * Environment: サーバーサイドのみ。
 * Errors: DBエラー時は throw。
 */
export async function createAnswersListLoader(request: Request, extraParams?: Record<string, any>) {
  const url = new URL(request.url);
  const profileIdQuery = url.searchParams.get('profileId') ?? undefined;

  // 共通データ取得
  const { getTopics, getUsers } = await import('~/lib/db');
  const topics = await getTopics();
  const topicsById = Object.fromEntries(topics.map(t => [String(t.id), t]));
  const users = await getUsers({ limit: 200 });

  // answersリストデータ
  const listData = await createListLoader('answers', request, extraParams);
  const answers = (listData as any).answers as Answer[];
  const answerIds = answers.map(a => a.id);

  // 追加データ
  const { getCommentsForAnswers, getUserAnswerData, getFavoriteCounts } = await import('~/lib/db');
  const commentsByAnswer = await getCommentsForAnswers(answerIds);
  const userAnswerData = profileIdQuery
    ? await getUserAnswerData(profileIdQuery, answerIds)
    : { votes: {}, favorites: new Set<number>() };
  const favCounts = await getFavoriteCounts(answerIds);

  // データマージ
  const answersWithUserData = mergeUserDataIntoAnswers(answers, userAnswerData, favCounts, profileIdQuery);

  return {
    ...listData,
    answers: answersWithUserData,
    topicsById,
    commentsByAnswer,
    users,
    profileId: profileIdQuery,
  };
}