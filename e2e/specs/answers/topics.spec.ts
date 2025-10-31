import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../utils/test-helpers';

/**
 * トピックページ機能テスト
 */

test.describe('Topics Page Functionality', () => {
  test('should display topics page with topic list', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // トピックページに移動
    await page.goto('/topics');

    // トピックページが表示されることを確認
    await expect(page).toHaveURL(/\/topics/);
    await expect(page.locator('h1')).toContainText('お題');

    // トピックが表示されることを確認
    const topicCount = await page.locator('ul li').count();
    expect(topicCount).toBeGreaterThan(0);
  });

  test('should search for specific topic and navigate to it', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // トピックページに移動
    await page.goto('/topics');

    // 検索フォームが表示されることを確認
    await expect(page.locator('input[name="q"]')).toBeVisible();
    await expect(page.locator('button:has-text("検索")')).toBeVisible();

    // 特定のトピックを検索
    const searchQuery = '「学生ロボットコンテスト」のテレビ欄。なんじゃそれ！何と書かれていた？';
    await page.fill('input[name="q"]', searchQuery);

    // 検索ボタンをクリック
    await page.click('button:has-text("検索")');

    // 検索結果が表示されるまで待機
    await page.waitForTimeout(1000);

    // 検索クエリがURLに反映されていることを確認
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(searchQuery)}`));

    // 該当するトピックが見つかることを確認
    const topicLink = page.locator('a[aria-label*="お題"]').first();
    await expect(topicLink).toBeVisible();

    // トピックリンクをクリックして個別トピックページに遷移
    await topicLink.click();

    // 個別トピックページに遷移することを確認
    await expect(page).toHaveURL(/\/topics\/\d+/);
  });
});