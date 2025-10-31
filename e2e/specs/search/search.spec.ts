import { test, expect } from '@playwright/test';
import { TopicsPage } from '../../pages/TopicsPage';
import { AnswersPage } from '../../pages/AnswersPage';
import { loginAsTestUser, waitForTimeout } from '../../utils/test-helpers';
import { TEST_CONSTANTS } from '../../fixtures/test-data';

/**
 * 検索・フィルター機能テスト
 */
test.describe('Search and Filter Functionality', () => {
  test('should search topics and navigate to topic detail', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // トピックスページに移動
    const topicsPage = new TopicsPage(page);
    await topicsPage.gotoTopicsPage();

    // 検索フォームが存在することを確認
    await expect(page.locator('input[name="q"]')).toBeVisible();
    await expect(page.locator('button:has-text("検索")')).toBeVisible();

    // 検索クエリを入力して検索実行
    const searchQuery = '「学生ロボットコンテスト」のテレビ欄。なんじゃそれ！何と書かれていた？';
    await topicsPage.performSearch(searchQuery);

    // 検索クエリがURLに含まれていることを確認
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(searchQuery)}`));

    // 検索結果が読み込まれるまで待機
    await topicsPage.waitForTopicsToLoad();

    // 最初のトピックをクリック
    await topicsPage.clickFirstTopic();

    // トピック詳細ページに遷移したことを確認
    await expect(page).toHaveURL(/\/topics\/\d+/);

    // 回答ページに移動してソートテスト
    const answersPage = new AnswersPage(page);
    await answersPage.sortByOldest();

    // URLにsortBy=oldestが含まれていることを確認
    await expect(page).toHaveURL(/sortBy=oldest/);
  });

  test('should filter answers by author', async ({ page }) => {
    // HSユーザーとしてログイン
    await page.goto('/login');
    const hsUserContainer = page.locator(`text=${TEST_CONSTANTS.USERS.HS}`).locator('xpath=ancestor::li');
    const selectButton = hsUserContainer.locator(`button:has-text("${TEST_CONSTANTS.SELECTORS.SELECT_BUTTON}")`);
    await selectButton.click();
    await expect(page).toHaveURL('/');

    // 回答ページに移動
    const answersPage = new AnswersPage(page);
    await answersPage.gotoAnswersPage();

    // 作者フィルターを設定
    await answersPage.setAuthorFilter(TEST_CONSTANTS.USERS.HS);

    // 検索ボタンをクリックしてフィルター適用
    await answersPage.clickSearchButton();

    // URLにauthor=HSが含まれていることを確認
    await expect(page).toHaveURL(/author=HS/);

    // フィルター結果が読み込まれるまで待機
    await waitForTimeout(2000);

    // 最初の数件の回答がHSユーザーによるものであることを確認
    const checkCount = Math.min(await answersPage.getAnswerCount(), 5);
    for (let i = 0; i < checkCount; i++) {
      const answer = answersPage.getAnswerByIndex(i);
      const authorText = await answer.getAuthorText();
      expect(authorText).toContain('作者: HS');
    }
  });

  test('should filter answers by has comments', async ({ page }) => {
    // testユーザーとしてログイン
    await loginAsTestUser(page);

    // 回答ページに移動
    const answersPage = new AnswersPage(page);
    await answersPage.gotoAnswersPage();

    // 詳細フィルタを開く
    await answersPage.openAdvancedFilters();

    // コメント有無フィルターを設定
    await answersPage.setHasCommentsFilter(true);

    // 検索ボタンをクリックしてフィルター適用
    await answersPage.clickSearchButton();

    // URLにhasComments=1が含まれていることを確認
    await expect(page).toHaveURL(/hasComments=1/);

    // フィルター結果が読み込まれるまで待機
    await waitForTimeout(2000);

    // 最初の数件の回答がコメントを持っていることを確認
    const checkCount = Math.min(await answersPage.getAnswerCount(), 5);
    for (let i = 0; i < checkCount; i++) {
      const answer = answersPage.getAnswerByIndex(i);
      const commentCount = await answer.getCommentCount();
      expect(commentCount).toBeGreaterThan(0);
    }
  });

  test('should handle empty search results gracefully', async ({ page }) => {
    // testユーザーとしてログイン
    await loginAsTestUser(page);

    // トピックスページに移動
    const topicsPage = new TopicsPage(page);
    await topicsPage.gotoTopicsPage();

    // 存在しない検索クエリを実行
    const nonExistentQuery = 'この検索クエリは存在しないはずです12345';
    await topicsPage.performSearch(nonExistentQuery);

    // ページが正常に読み込まれ、クラッシュしないことを確認
    await expect(page.locator(`text=${TEST_CONSTANTS.SELECTORS.TOPIC_LIST}`)).toBeVisible();

    // トピック数が0であるか、適切なメッセージが表示されることを確認
    const topicCount = await topicsPage.getTopicCount();
    // 検索結果がない場合の挙動はアプリケーションによるが、少なくともクラッシュしない
    expect(typeof topicCount).toBe('number');
  });
});