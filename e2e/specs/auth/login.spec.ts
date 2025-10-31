import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { TEST_CONSTANTS } from '../../fixtures/test-data';

/**
 * 認証関連のテストケース
 */

test.describe('Authentication', () => {
  test('should login as HS user', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // HSユーザーを選択（直接page.locatorを使用）
    await page.goto('/login');
    const hsUserContainer = page.locator(`text=${TEST_CONSTANTS.USERS.HS}`).locator('xpath=ancestor::li');
    const selectButton = hsUserContainer.locator(`button:has-text("${TEST_CONSTANTS.SELECTORS.SELECT_BUTTON}")`);
    await selectButton.click();

    // ホームページにリダイレクトされることを確認
    await expect(page).toHaveURL('/');

    // ナビゲーションバーにHSユーザーが表示されていることを確認
    await loginPage.verifyUserInHeader(TEST_CONSTANTS.USERS.HS);
  });

  test('should switch to test sub-user', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // まずHSユーザーを選択
    await page.goto('/login');
    const hsUserContainer = page.locator(`text=${TEST_CONSTANTS.USERS.HS}`).locator('xpath=ancestor::li');
    const selectButton = hsUserContainer.locator(`button:has-text("${TEST_CONSTANTS.SELECTORS.SELECT_BUTTON}")`);
    await selectButton.click();
    await expect(page).toHaveURL('/');

    // HSユーザーの詳細を開く
    await page.goto('/login');
    const hsDetailsButton = hsUserContainer.locator(`button:has-text("${TEST_CONSTANTS.SELECTORS.DETAILS_BUTTON}")`);
    await hsDetailsButton.click();

    // testサブユーザーを選択
    await page.locator(`text=${TEST_CONSTANTS.USERS.TEST}`).locator('xpath=following-sibling::button').click();

    // ホームページにリダイレクトされることを確認
    await expect(page).toHaveURL('/');

    // ナビゲーションバーにtestユーザーが表示されていることを確認
    await loginPage.verifyUserInHeader(TEST_CONSTANTS.USERS.TEST);
  });
});