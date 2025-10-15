import type { Answer } from '~/lib/schemas/answer';

/**
 * 概要: answersにuser-specific dataをマージするヘルパー関数。
 * Contract:
 *   - Input: answers (Answer[]), userData ({ votes: Record<number, number>; favorites: Set<number> } | null), favCounts (Record<number, number>)
 *   - Output: マージされたAnswer[]
 * Environment: サーバーサイドのみ。
 * Errors: なし（データが存在しない場合はデフォルト値）。
 */
export function mergeUserDataIntoAnswers(
  answers: Answer[],
  userData: { votes: Record<number, number>; favorites: Set<number> } | null,
  favCounts: Record<number, number>,
  profileId?: string
): Answer[] {
  return answers.map(a => {
    const embeddedVotes = a.votesBy ?? {};
    const mergedVotesBy = { ...embeddedVotes };
    if (profileId && userData?.votes[a.id]) {
      mergedVotesBy[profileId] = userData.votes[a.id];
    }

    return {
      ...a,
      votesBy: mergedVotesBy,
      favorited: userData?.favorites.has(a.id) ?? undefined,
      favCount: favCounts[Number(a.id)] ?? 0,
    } as Answer & { favCount: number };
  });
}