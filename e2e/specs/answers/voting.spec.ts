import { test, expect } from '@playwright/test';
import { loginAsTestUser, setupAnswersPageSortedByOldest, waitForSuccessToast, resetVoteButtons } from '../../utils/test-helpers';

/**
 * 回答ページの投票機能テスト
 */
test.describe('Answers Page - Voting', () => {
  test('should handle vote persistence after page reload', async ({ page }) => {
    await loginAsTestUser(page);
    const answersPage = await setupAnswersPageSortedByOldest(page);
    const firstAnswer = answersPage.getFirstAnswer();

    // コメントセクションを開く
    await firstAnswer.openCommentSection();

    // 投票をリセット
    await resetVoteButtons(firstAnswer);

    // 投票レベル3で投票
    await firstAnswer.clickVoteButton(3);
    await waitForSuccessToast(page);

    // 投票状態を確認
    expect(await firstAnswer.getVoteState(3)).toBe(true);

    // ページをリロード
    await page.reload();
    await answersPage.waitForAnswersToLoad();

    // コメントセクションを再度開く
    const reloadedFirstAnswer = answersPage.getFirstAnswer();
    await reloadedFirstAnswer.openCommentSection();

    // 投票状態が維持されていることを確認
    expect(await reloadedFirstAnswer.getVoteState(3)).toBe(true);
  });

  test('should toggle vote off correctly', async ({ page }) => {
    await loginAsTestUser(page);
    const answersPage = await setupAnswersPageSortedByOldest(page);
    const firstAnswer = answersPage.getFirstAnswer();

    await firstAnswer.openCommentSection();

    // まず投票レベル3をオンにする
    await resetVoteButtons(firstAnswer);
    await firstAnswer.clickVoteButton(3);
    await waitForSuccessToast(page);
    expect(await firstAnswer.getVoteState(3)).toBe(true);

    // 同じボタンを再度クリックしてオフにする
    await firstAnswer.clickVoteButton(3);
    await waitForSuccessToast(page);
    expect(await firstAnswer.getVoteState(3)).toBe(false);
  });
});