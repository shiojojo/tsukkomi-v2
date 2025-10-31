import type { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * 回答一覧ページのPage Object
 */
export class AnswersPage extends BasePage {
  // ページ要素のセレクター（テキストベースに戻す - データ属性はUI実装後に変更）
  private readonly answerListText = '回答一覧';
  private readonly searchButton = '検索';
  private readonly oldestOption = 'oldest';

  constructor(page: Page) {
    super(page);
  }

  /**
   * 回答一覧ページに移動
   */
  async gotoAnswersPage(): Promise<void> {
    await this.goto('/answers');
    await this.waitForTitle(/Tsukkomi V2/);
    await this.waitForText(this.answerListText);
  }

  /**
   * ソート順をoldestに設定
   */
  async sortByOldest(): Promise<void> {
    const sortSelect = this.page.locator('select[name="sortBy"]');
    await this.waitForVisible(sortSelect);
    await sortSelect.selectOption(this.oldestOption);

    // 検索ボタンをクリックしてソートを適用
    await this.clickSearchButton();

    // URLが更新されるまで待機
    await this.page.waitForURL((url) => url.searchParams.has('sortBy'), { timeout: 10000 });
  }

  /**
   * 検索ボタンをクリック
   */
  async clickSearchButton(): Promise<void> {
    const searchButton = this.page.locator(`button:has-text("${this.searchButton}")`);
    await this.clickWhenReady(searchButton);
  }

  /**
   * 回答が読み込まれるまで待機
   */
  async waitForAnswersToLoad(): Promise<void> {
    // 回答リストが表示されるまで待機
    await this.page.waitForSelector('ul li', { timeout: 15000 });
    await this.waitForLoadingComplete();
  }

  /**
   * 最初の回答を取得
   */
  getFirstAnswer(): AnswerCard {
    const firstAnswerElement = this.page.locator('ul li').first();
    return new AnswerCard(firstAnswerElement, this.page);
  }

  /**
   * 指定されたインデックスの回答を取得
   */
  getAnswerByIndex(index: number): AnswerCard {
    const answerElement = this.page.locator('ul li').nth(index);
    return new AnswerCard(answerElement, this.page);
  }

  /**
   * 回答の総数を取得
   */
  async getAnswerCount(): Promise<number> {
    const answers = this.page.locator('ul li');
    return await answers.count();
  }

  /**
   * 詳細フィルタボタンをクリック（閉じている場合のみ開く）
   */
  async openAdvancedFilters(): Promise<void> {
    const closeButton = this.page.locator('button:has-text("詳細を閉じる")');
    const openButton = this.page.locator('button:has-text("詳細フィルタ")');

    // すでに開いている場合は何もしない
    if (await closeButton.isVisible()) {
      return;
    }

    // 閉じている場合は開く
    if (await openButton.isVisible()) {
      await this.clickWhenReady(openButton);
    }
  }

  /**
   * 作者フィルターを設定
   */
  async setAuthorFilter(author: string): Promise<void> {
    const authorSelect = this.page.locator('select[name="author"]');
    await this.waitForVisible(authorSelect);
    await authorSelect.selectOption(author);
  }

  /**
   * コメント有無フィルターを設定
   */
  async setHasCommentsFilter(hasComments: boolean): Promise<void> {
    const hasCommentsCheckbox = this.page.locator('input[name="hasComments"]');
    await this.waitForVisible(hasCommentsCheckbox);

    if (hasComments) {
      await hasCommentsCheckbox.check();
    } else {
      await hasCommentsCheckbox.uncheck();
    }
  }
}

/**
 * 個別の回答カードの操作を扱うクラス
 */
export class AnswerCard {
  private readonly element: Locator;
  private readonly page: Page;

  constructor(element: Locator, page: Page) {
    this.element = element;
    this.page = page;
  }

  /**
   * 回答カードが表示されているか確認
   */
  async isVisible(): Promise<boolean> {
    return await this.element.isVisible();
  }

  /**
   * お気に入りボタンをクリック
   */
  async clickFavoriteButton(): Promise<void> {
    const favoriteButton = this.element.locator('button[aria-pressed]').first();
    await favoriteButton.waitFor({ state: 'visible' });
    await favoriteButton.click();
  }

  /**
   * お気に入り状態を取得
   */
  async isFavorited(): Promise<boolean> {
    const favoriteButton = this.element.locator('button[aria-pressed]').first();
    const ariaPressed = await favoriteButton.getAttribute('aria-pressed');
    return ariaPressed === 'true';
  }

  /**
   * コメント/採点セクションを開く
   */
  async openCommentSection(): Promise<void> {
    const toggleButton = this.element.locator('button:has-text("コメント / 採点")').first();
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
    }
  }

  /**
   * 投票ボタンをクリック（レベル指定）
   */
  async clickVoteButton(level: 1 | 2 | 3): Promise<void> {
    const voteButton = this.element.locator(`button[aria-label="投票${level}"]`).first();
    await voteButton.waitFor({ state: 'visible' });
    await voteButton.click();
  }

  /**
   * 投票ボタンの状態を取得
   */
  async getVoteState(level: 1 | 2 | 3): Promise<boolean> {
    const voteButton = this.element.locator(`button[aria-label="投票${level}"]`).first();
    const ariaPressed = await voteButton.getAttribute('aria-pressed');
    return ariaPressed === 'true';
  }

  /**
   * コメントを入力
   */
  async enterComment(text: string): Promise<void> {
    const commentTextarea = this.element.locator('textarea[name="text"]').first();
    await commentTextarea.waitFor({ state: 'visible' });
    await commentTextarea.fill(text);
  }

  /**
   * コメント送信ボタンをクリック
   */
  async submitComment(): Promise<void> {
    const submitButton = this.element.locator('button[aria-label="コメントを送信"]').first();
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.click();
  }

  /**
   * スコアを取得
   */
  async getScore(): Promise<number> {
    const scoreElement = this.element.locator('text=/Score:\\s*\\d+/').first();
    const scoreText = await scoreElement.textContent();
    if (scoreText) {
      const match = scoreText.match(/Score:\s*(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
    return 0;
  }

  /**
   * コメント数を取得
   */
  async getCommentCount(): Promise<number> {
    const commentText = await this.element.locator('text=/コメント\\d+/').textContent();
    if (commentText) {
      const match = commentText.match(/コメント(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
    return 0;
  }

  /**
   * 回答テキストを取得
   */
  async getAnswerText(): Promise<string> {
    const answerElement = this.element.locator('p').first();
    return await answerElement.textContent() || '';
  }

  /**
   * 作者テキストを取得
   */
  async getAuthorText(): Promise<string> {
    const authorElement = this.element.locator('text=/作者:/').first();
    return await authorElement.textContent() || '';
  }
}