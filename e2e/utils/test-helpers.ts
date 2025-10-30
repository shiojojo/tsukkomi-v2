import type { Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AnswersPage, AnswerCard } from '../pages/AnswersPage';
import { TEST_CONSTANTS } from '../fixtures/test-data';

/**
 * テストヘルパー関数群
 */

/**
 * HSユーザーのサブユーザーtestとしてログインする共通処理
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.loginAsTestUser();
  await loginPage.verifyUserInHeader(TEST_CONSTANTS.USERS.TEST);
}

/**
 * 回答ページでoldest順にソートする共通処理
 */
export async function setupAnswersPageSortedByOldest(page: Page): Promise<AnswersPage> {
  const answersPage = new AnswersPage(page);
  await answersPage.gotoAnswersPage();
  await answersPage.sortByOldest();
  await answersPage.waitForAnswersToLoad();
  return answersPage;
}

/**
 * トーストメッセージが表示されるまで待機
 */
export async function waitForToast(page: Page, message: string, timeout = 5000): Promise<void> {
  await page.waitForSelector(`text=${message}`, { timeout });
}

/**
 * 成功トーストが表示されるまで待機
 */
export async function waitForSuccessToast(page: Page, timeout = 5000): Promise<void> {
  await waitForToast(page, TEST_CONSTANTS.MESSAGES.SUCCESS, timeout);
  await waitForToast(page, TEST_CONSTANTS.MESSAGES.OPERATION_COMPLETED, timeout);
}

/**
 * ページが完全に読み込まれるまで待機
 */
export async function waitForPageLoad(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * 指定された時間待機（デバッグ用）
 */
export async function waitForTimeout(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 要素が表示されるまで待機
 */
export async function waitForElement(page: Page, selector: string, timeout = 10000): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}

/**
 * 投票ボタンの状態をリセットする（すべての投票を解除）
 */
export async function resetVoteButtons(answerCard: AnswerCard): Promise<void> {
  // 各投票レベルのボタンを順番にチェックしてリセット
  for (let level = 1 as const; level <= 3; level++) {
    const isActive = await answerCard.getVoteState(level);
    if (isActive) {
      await answerCard.clickVoteButton(level);
      await waitForTimeout(500);
    }
  }
}

/**
 * 現在のページURLを取得
 */
export function getCurrentURL(page: Page): string {
  return page.url();
}

/**
 * URLが期待値を含むかチェック
 */
export function urlContains(url: string, expected: string): boolean {
  return url.includes(expected);
}

/**
 * テストの実行時間を測定するデコレーター
 */
export function measureExecutionTime<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  label: string
): T {
  return (async (...args: Parameters<T>) => {
    const start = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      console.log(`${label} executed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`${label} failed after ${duration}ms:`, error);
      throw error;
    }
  }) as T;
}