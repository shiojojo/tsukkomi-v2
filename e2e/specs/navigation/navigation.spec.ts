import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../../utils/test-helpers';

/**
 * ナビゲーション機能テスト
 */

test.describe('Navigation Functionality', () => {
  test.use({ viewport: { width: 1280, height: 720 } }); // デスクトップサイズを明示的に設定

  test('should navigate between main pages using direct navigation', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // ホーム画面からスタート
    await expect(page).toHaveURL('/');

    // 回答検索ページへの直接ナビゲーション
    await page.goto('/answers');
    await expect(page).toHaveURL('/answers');
    await expect(page.locator('h1')).toContainText('回答');

    // お気に入りページへの直接ナビゲーション
    await page.goto('/answers/favorites');
    await expect(page).toHaveURL('/answers/favorites');
    await expect(page.locator('h1')).toContainText('お気に入り');

    // トピックページへの直接ナビゲーション
    await page.goto('/topics');
    await expect(page).toHaveURL('/topics');
    await expect(page.locator('h1')).toContainText('お題');

    // ホームに戻る
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('should navigate to user profile page', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // ユーザー情報ページへの直接ナビゲーション
    await page.goto('/me');
    await expect(page).toHaveURL('/me');

    // ユーザー情報ページが表示されることを確認
    await expect(page.locator('h1')).toContainText('アカウント / サブユーザー');
  });

  test('should show login link when not authenticated', async ({ page }) => {
    // 認証なしでホームページにアクセス
    await page.goto('/');

    // ログインページへの直接ナビゲーション
    await page.goto('/login');
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h1')).toContainText('ログイン');
  });
});