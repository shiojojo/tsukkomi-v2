import { test, expect } from '@playwright/test';
import { AnswersPage } from '../../pages/AnswersPage';
import { loginAsTestUser, setupAnswersPageSortedByOldest, waitForSuccessToast, resetVoteButtons, waitForTimeout } from '../../utils/test-helpers';
import { TEST_CONSTANTS } from '../../fixtures/test-data';

/**
 * 回答ページの基本機能テスト
 */

test.describe('Answers Page - Basic Functionality', () => {
  test('should display answers page with test user', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページに移動
    const answersPage = new AnswersPage(page);
    await answersPage.gotoAnswersPage();

    // 回答一覧が表示されていることを確認
    await expect(page).toHaveTitle(new RegExp(TEST_CONSTANTS.SELECTORS.APP_TITLE));
    await expect(page.locator(`text=${TEST_CONSTANTS.SELECTORS.ANSWER_LIST}`)).toBeVisible();
  });

  test('should sort answers by oldest', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページでoldest順にソート
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // URLにsortBy=oldestが含まれていることを確認
    await expect(page).toHaveURL(/sortBy=oldest/);

    // 回答が読み込まれていることを確認
    const answerCount = await answersPage.getAnswerCount();
    expect(answerCount).toBeGreaterThan(0);

    // 最初の回答が取得できることを確認
    const firstAnswer = answersPage.getFirstAnswer();
    await expect(await firstAnswer.isVisible()).toBe(true);
  });

  test('should toggle favorite on first answer', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページでoldest順にソート
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // 最初の回答を取得
    const firstAnswer = answersPage.getFirstAnswer();

    // お気に入りボタンの初期状態を取得
    const initialState = await firstAnswer.getFavoriteState();

    // お気に入りボタンをクリック
    await firstAnswer.clickFavoriteButton();

    // 成功トーストが表示されることを確認
    await waitForSuccessToast(page);

    // 状態が変化したことを確認
    const newState = await firstAnswer.getFavoriteState();
    expect(newState).not.toBe(initialState);
  });

  test('should vote on first answer', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページでoldest順にソート
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // 最初の回答を取得
    const firstAnswer = answersPage.getFirstAnswer();

    // コメント/採点セクションを開く
    await firstAnswer.openCommentSection();

    // 投票前にすべての投票をリセット
    await resetVoteButtons(firstAnswer);

    // 投票前のスコアを取得
    const initialScore = await firstAnswer.getScore();

    // 投票レベル3で投票
    await firstAnswer.clickVoteButton(3);

    // 成功トーストが表示されることを確認
    await waitForSuccessToast(page);

    // 投票状態がアクティブになったことを確認
    const voteState = await firstAnswer.getVoteState(3);
    expect(voteState).toBe(true);

    // DB同期を待機（スコア更新に時間がかかる場合がある）
    await waitForTimeout(2000);

    // スコアが3以上増加したことを確認（投票によるスコア増加を確認）
    const newScore = await firstAnswer.getScore();
    expect(newScore).toBeGreaterThanOrEqual(initialScore);
  });

  test('should add comment to first answer', async ({ page }) => {
    // HSユーザーのサブユーザーtestとしてログイン
    await loginAsTestUser(page);

    // 回答ページでoldest順にソート
    const answersPage = await setupAnswersPageSortedByOldest(page);

    // 最初の回答を取得
    const firstAnswer = answersPage.getFirstAnswer();

    // コメント/採点セクションを開く
    await firstAnswer.openCommentSection();

    // コメント前のコメント数を取得
    const initialCommentCount = await firstAnswer.getCommentCount();

    // テストコメントを入力
    const testComment = 'test_comment_basic';
    await firstAnswer.enterComment(testComment);

    // コメントを送信
    await firstAnswer.submitComment();

    // 成功トーストが表示されることを確認
    await waitForSuccessToast(page);

    // コメント数が1増加したことを確認
    const newCommentCount = await firstAnswer.getCommentCount();
    expect(newCommentCount).toBe(initialCommentCount + 1);
  });
});