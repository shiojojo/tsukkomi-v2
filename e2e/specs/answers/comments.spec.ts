import { test, expect } from '@playwright/test';
import { loginAsTestUser, setupAnswersPageSortedByOldest, waitForSuccessToast, waitForTimeout } from '../../utils/test-helpers';

/**
 * 回答ページのコメント機能テスト
 */
test.describe('Answers Page - Comments', () => {
  test('should add comment and update count', async ({ page }) => {
    await loginAsTestUser(page);
    const answersPage = await setupAnswersPageSortedByOldest(page);
    const firstAnswer = answersPage.getFirstAnswer();

    // コメント/採点セクションを開く
    await firstAnswer.openCommentSection();

    // コメント前のコメント数を取得
    const initialCommentCount = await firstAnswer.getCommentCount();

    // テストコメントを入力
    const testComment = 'test_comment_functionality';
    await firstAnswer.enterComment(testComment);

    // コメントを送信
    await firstAnswer.submitComment();

    // 成功トーストが表示されることを確認
    await waitForSuccessToast(page);

    // DB同期を待機（コメント追加に時間がかかる場合がある）
    await waitForTimeout(3000);

    // コメント数が1増加したことを確認
    const newCommentCount = await firstAnswer.getCommentCount();
    expect(newCommentCount).toBe(initialCommentCount + 1);
  });

  test('should persist comment after page reload', async ({ page }) => {
    await loginAsTestUser(page);
    const answersPage = await setupAnswersPageSortedByOldest(page);
    const firstAnswer = answersPage.getFirstAnswer();

    // コメント/採点セクションを開く
    await firstAnswer.openCommentSection();

    // コメント前のコメント数を取得
    const initialCommentCount = await firstAnswer.getCommentCount();

    // テストコメントを入力
    const testComment = 'test_comment_persistence';
    await firstAnswer.enterComment(testComment);

    // コメントを送信
    await firstAnswer.submitComment();

    // 成功トーストが表示されることを確認
    await waitForSuccessToast(page);

    // DB同期を待機
    await waitForTimeout(3000);

    // ページをリロード
    await page.reload();
    await answersPage.waitForAnswersToLoad();

    // コメントセクションを再度開く
    const reloadedFirstAnswer = answersPage.getFirstAnswer();
    await reloadedFirstAnswer.openCommentSection();

    // コメント数が維持されていることを確認（少なくとも1増加）
    const reloadedCommentCount = await reloadedFirstAnswer.getCommentCount();
    expect(reloadedCommentCount).toBeGreaterThanOrEqual(initialCommentCount + 1);
  });

  test('should handle multiple comments correctly', async ({ page }) => {
    await loginAsTestUser(page);
    const answersPage = await setupAnswersPageSortedByOldest(page);
    const firstAnswer = answersPage.getFirstAnswer();

    // コメント/採点セクションを開く
    await firstAnswer.openCommentSection();

    // コメント前のコメント数を取得
    const initialCommentCount = await firstAnswer.getCommentCount();

    // 複数のコメントを追加
    const comments = ['first_comment_test', 'second_comment_test'];

    for (const comment of comments) {
      await firstAnswer.enterComment(comment);
      await firstAnswer.submitComment();
      await waitForSuccessToast(page);
      await waitForTimeout(2000); // 各コメント間の待機
    }

    // DB同期を待機
    await waitForTimeout(3000);

    // コメント数が正しく増加したことを確認（少なくとも指定数増加）
    const finalCommentCount = await firstAnswer.getCommentCount();
    expect(finalCommentCount).toBeGreaterThanOrEqual(initialCommentCount + comments.length);
  });
});