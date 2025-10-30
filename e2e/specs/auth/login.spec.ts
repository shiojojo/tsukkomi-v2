import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { TEST_CONSTANTS } from '../../fixtures/test-data';

/**
 * 認証関連のテストケース
 */

test.describe('Authentication', () => {
  test('should login as HS user', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // HSユーザーを選択
    await loginPage.selectUser(TEST_CONSTANTS.USERS.HS);

    // ホームページにリダイレクトされることを確認
    await expect(page).toHaveURL('/');

    // ナビゲーションバーにHSユーザーが表示されていることを確認
    await loginPage.verifyUserInHeader(TEST_CONSTANTS.USERS.HS);
  });

  test('should switch to test sub-user', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // まずHSユーザーを選択
    await loginPage.selectUser(TEST_CONSTANTS.USERS.HS);
    await expect(page).toHaveURL('/');

    // HSユーザーの詳細を開く
    await loginPage.gotoLoginPage();
    await loginPage.openHSUserDetails();

    // testサブユーザーを選択
    await loginPage.selectSubUser(TEST_CONSTANTS.USERS.TEST);

    // ホームページにリダイレクトされることを確認
    await expect(page).toHaveURL('/');

    // ナビゲーションバーにtestユーザーが表示されていることを確認
    await loginPage.verifyUserInHeader(TEST_CONSTANTS.USERS.TEST);
  });

  test('should login as test user directly', async ({ page }) => {
    const loginPage = new LoginPage(page);

    // HSユーザーのサブユーザーtestとして直接ログイン
    await loginPage.loginAsTestUser();

    // ホームページにリダイレクトされることを確認
    await expect(page).toHaveURL('/');

    // ナビゲーションバーにtestユーザーが表示されていることを確認
    await loginPage.verifyUserInHeader(TEST_CONSTANTS.USERS.TEST);
  });
});