import { describe, it, expect } from 'vitest';
import { mergeUserDataIntoAnswers } from '~/lib/utils/dataMerging';
import type { Answer } from '~/lib/schemas/answer';

describe('mergeUserDataIntoAnswers', () => {
  const mockAnswers: Answer[] = [
    {
      id: 1,
      text: 'Answer 1',
      profileId: 'user1',
      topicId: 1,
      created_at: '2024-01-01T00:00:00Z',
      votes: { level1: 0, level2: 0, level3: 0 },
      votesBy: {},
      favCount: 0,
    },
    {
      id: 2,
      text: 'Answer 2',
      profileId: 'user2',
      topicId: 1,
      created_at: '2024-01-01T00:00:00Z',
      votes: { level1: 0, level2: 0, level3: 0 },
      votesBy: { user3: 1 },
      favCount: 0,
    },
  ];

  it('userDataがnullの場合、デフォルト値を設定する', () => {
    const favCounts = { 1: 5, 2: 3 };
    const result = mergeUserDataIntoAnswers(mockAnswers, null, favCounts);

    expect(result).toHaveLength(2);
    expect(result[0].favorited).toBeUndefined();
    expect((result[0] as Answer & { favCount: number }).favCount).toBe(5);
    expect(result[1].favorited).toBeUndefined();
    expect((result[1] as Answer & { favCount: number }).favCount).toBe(3);
  });

  it('ユーザーの投票データをマージする', () => {
    const userData = {
      votes: { 1: 2, 2: 3 },
      favorites: new Set<number>([1]),
    };
    const favCounts = { 1: 5, 2: 3 };
    const result = mergeUserDataIntoAnswers(mockAnswers, userData, favCounts, 'currentUser');

    expect(result[0].votesBy).toEqual({ currentUser: 2 });
    expect(result[0].favorited).toBe(true);
    expect((result[0] as Answer & { favCount: number }).favCount).toBe(5);

    expect(result[1].votesBy).toEqual({ user3: 1, currentUser: 3 });
    expect(result[1].favorited).toBe(false);
    expect((result[1] as Answer & { favCount: number }).favCount).toBe(3);
  });

  it('profileIdが指定されていない場合、投票データをマージしない', () => {
    const userData = {
      votes: { 1: 2 },
      favorites: new Set<number>(),
    };
    const favCounts = { 1: 5, 2: 3 };
    const result = mergeUserDataIntoAnswers(mockAnswers, userData, favCounts);

    expect(result[0].votesBy).toEqual({});
    expect(result[1].votesBy).toEqual({ user3: 1 });
  });

  it('favCountsが存在しない場合、0を設定する', () => {
    const userData = {
      votes: {},
      favorites: new Set<number>(),
    };
    const favCounts = {};
    const result = mergeUserDataIntoAnswers(mockAnswers, userData, favCounts, 'currentUser');

    expect((result[0] as Answer & { favCount: number }).favCount).toBe(0);
    expect((result[1] as Answer & { favCount: number }).favCount).toBe(0);
  });

  it('空のanswers配列を処理する', () => {
    const userData = {
      votes: {},
      favorites: new Set<number>(),
    };
    const favCounts = {};
    const result = mergeUserDataIntoAnswers([], userData, favCounts);

    expect(result).toEqual([]);
  });
});