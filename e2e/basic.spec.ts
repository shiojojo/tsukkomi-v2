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

test('select HS user', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('text=HS')).toBeVisible();
  
  // Find the button next to HS user name
  const hsUserContainer = page.locator('text=HS').locator('xpath=ancestor::li');
  const selectButton = hsUserContainer.locator('button:has-text("選択")');
  await selectButton.click();
  
  await expect(page).toHaveURL('/');
  
  // Check that HS is displayed in the header
  await expect(page.locator('nav[aria-label="Main"] span:has-text("HS")').first()).toBeVisible();
});