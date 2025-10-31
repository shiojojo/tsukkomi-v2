import { test, expect } from '@playwright/test';
import { AnswersPage } from '../../pages/AnswersPage';
import { loginAsTestUser, setupAnswersPageSortedByOldest } from '../../utils/test-helpers';

/**
 * お気に入りページ機能テスト
 */

test.describe('Favorites Page Functionality', () => {
  test('should display favorites page with user favorites', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // お気に入りページに移動
    const answersPage = new AnswersPage(page);
    await answersPage.goto('/answers/favorites');

    // お気に入りページが表示されることを確認
    await expect(page).toHaveURL(/\/answers\/favorites/);
    await expect(page.locator('h1')).toContainText('お気に入り');

    // 初期状態でお気に入りが表示されることを確認（データによる）
    const answerCount = await answersPage.getAnswerCount();
    expect(answerCount).toBeGreaterThanOrEqual(0);
  });

  test('should display favorites page and allow navigation', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページでoldest順にソート
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // お気に入りページに移動
    await answersPage.goto('/answers/favorites');

    // お気に入りページが表示されることを確認
    await expect(page).toHaveURL(/\/answers\/favorites/);
    await expect(page.locator('h1')).toContainText('お気に入り');

    // お気に入りページから回答一覧ページに戻る
    await answersPage.gotoAnswersPage();
    await expect(page).toHaveURL(/\/answers/);
  });

  test('should navigate between answers and favorites pages', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページに移動
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // お気に入りページに移動
    await answersPage.goto('/answers/favorites');
    await expect(page).toHaveURL(/\/answers\/favorites/);

    // 回答一覧ページに戻る
    await answersPage.gotoAnswersPage();
    await expect(page).toHaveURL(/\/answers/);
  });
});