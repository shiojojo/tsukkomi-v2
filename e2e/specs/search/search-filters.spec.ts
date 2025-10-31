import { test, expect } from '@playwright/test';
import { loginAsTestUser, setupAnswersPageSortedByOldest } from '../../utils/test-helpers';

/**
 * 検索・フィルター機能テスト
 */

test.describe('Search and Filter Functionality', () => {
  test('should filter answers by author (HS)', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページでoldest順にソート
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // 初期状態の回答数を確認
    const initialAnswerCount = await answersPage.getAnswerCount();

    // 作者フィルターをHSに設定
    await answersPage.setAuthorFilter('HS');

    // 検索ボタンをクリックしてフィルターを適用
    await answersPage.clickSearchButton();

    // URLにauthor=HSが含まれていることを確認
    await expect(page).toHaveURL(/author=HS/);

    // フィルター後の回答数を確認
    const filteredAnswerCount = await answersPage.getAnswerCount();
    expect(filteredAnswerCount).toBeGreaterThan(0);
    expect(filteredAnswerCount).toBeLessThanOrEqual(initialAnswerCount);

    // 各回答がHSユーザーによるものであることを確認（最初の5件）
    const checkCount = Math.min(5, filteredAnswerCount);
    for (let i = 0; i < checkCount; i++) {
      const answer = answersPage.getAnswerByIndex(i);
      const authorText = await answer.getAuthorText();

      // 作者がHSであることを確認
      expect(authorText).toBe('作者: HS');
    }
  });

  test('should filter answers by has comments', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページでoldest順にソート
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // 初期状態の回答数を確認
    const initialAnswerCount = await answersPage.getAnswerCount();

    // 詳細フィルタを開く
    await answersPage.openAdvancedFilters();

    // コメント有無フィルターを有効化
    await answersPage.setHasCommentsFilter(true);

    // 検索ボタンをクリックしてフィルターを適用
    await answersPage.clickSearchButton();

    // URLにhasComments=1が含まれていることを確認
    await expect(page).toHaveURL(/hasComments=1/);

    // フィルター後の回答数を確認
    const filteredAnswerCount = await answersPage.getAnswerCount();
    expect(filteredAnswerCount).toBeGreaterThanOrEqual(0);
    expect(filteredAnswerCount).toBeLessThanOrEqual(initialAnswerCount);

    // 各回答にコメントがあることを確認（最初の5件）
    const checkCount = Math.min(5, filteredAnswerCount);
    for (let i = 0; i < checkCount; i++) {
      const answer = answersPage.getAnswerByIndex(i);
      const commentCount = await answer.getCommentCount();
      expect(commentCount).toBeGreaterThan(0);
    }
  });

  test('should combine author and has comments filters', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページでoldest順にソート
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // 作者フィルターをHSに設定
    await answersPage.setAuthorFilter('HS');

    // 詳細フィルタを開く
    await answersPage.openAdvancedFilters();

    // コメント有無フィルターを有効化
    await answersPage.setHasCommentsFilter(true);

    // 検索ボタンをクリックして両方のフィルターを適用
    await answersPage.clickSearchButton();

    // URLに両方のフィルターが含まれていることを確認
    await expect(page).toHaveURL(/author=HS/);
    await expect(page).toHaveURL(/hasComments=1/);

    // フィルター後の回答数を確認
    const filteredAnswerCount = await answersPage.getAnswerCount();

    // 各回答がHSユーザーによるもので、コメントがあることを確認（最初の3件）
    const checkCount = Math.min(3, filteredAnswerCount);
    for (let i = 0; i < checkCount; i++) {
      const answer = answersPage.getAnswerByIndex(i);
      const authorText = await answer.getAuthorText();
      const commentCount = await answer.getCommentCount();

      expect(authorText).toBe('作者: HS');
      expect(commentCount).toBeGreaterThan(0);
    }
  });

  test('should correctly filter answers by HS author with comments', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページでoldest順にソート
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // 作者フィルターをHSに設定
    await answersPage.setAuthorFilter('HS');

    // 詳細フィルタを開く
    await answersPage.openAdvancedFilters();

    // コメント有無フィルターを有効化
    await answersPage.setHasCommentsFilter(true);

    // フィルター適用
    await answersPage.clickSearchButton();

    // URLに両方のフィルターが含まれていることを確認
    await expect(page).toHaveURL(/author=HS/);
    await expect(page).toHaveURL(/hasComments=1/);

    // フィルター適用後の回答数を確認
    const filteredAnswerCount = await answersPage.getAnswerCount();

    // 各回答がHSユーザーによるもので、コメントがあることを確認（最初の3件）
    const checkCount = Math.min(3, filteredAnswerCount);
    for (let i = 0; i < checkCount; i++) {
      const answer = answersPage.getAnswerByIndex(i);
      const authorText = await answer.getAuthorText();
      const commentCount = await answer.getCommentCount();

      expect(authorText).toBe('作者: HS');
      expect(commentCount).toBeGreaterThan(0);
    }
  });
});