import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Tsukkomi V2/);
  await expect(page.locator('text=Tsukkomi — 今日のお題')).toBeVisible();
});

test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/Tsukkomi V2/);
  await expect(page.locator('text=ログイン（開発用）')).toBeVisible();
});