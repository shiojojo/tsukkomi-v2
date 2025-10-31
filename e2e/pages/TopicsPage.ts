import type { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * トピックス一覧ページのPage Object
 */
export class TopicsPage extends BasePage {
  // ページ要素のセレクター
  private readonly topicsListText = 'お題一覧';
  private readonly searchInput = 'input[name="q"]';
  private readonly searchButton = 'button:has-text("検索")';

  constructor(page: Page) {
    super(page);
  }

  /**
   * トピックスページに移動
   */
  async gotoTopicsPage(): Promise<void> {
    await this.goto('/topics');
    await this.waitForTitle(/Tsukkomi V2/);
    await this.waitForText(this.topicsListText);
  }

  /**
   * 検索クエリを入力
   */
  async enterSearchQuery(query: string): Promise<void> {
    const searchInput = this.page.locator(this.searchInput);
    await this.waitForVisible(searchInput);
    await searchInput.fill(query);
  }

  /**
   * 検索を実行
   */
  async clickSearchButton(): Promise<void> {
    const searchButton = this.page.locator(this.searchButton);
    await this.clickWhenReady(searchButton);
  }

  /**
   * 検索を実行（クエリ入力から検索まで）
   */
  async performSearch(query: string): Promise<void> {
    await this.enterSearchQuery(query);
    await this.clickSearchButton();
    // URLが更新されるまで待機
    await this.page.waitForURL((url) => url.searchParams.has('q'), { timeout: 10000 });
  }

  /**
   * 最初のトピックリンクを取得
   */
  getFirstTopicLink(): Locator {
    return this.page.locator('a[aria-label*="お題"]').first();
  }

  /**
   * 最初のトピックをクリック
   */
  async clickFirstTopic(): Promise<void> {
    const firstTopicLink = this.getFirstTopicLink();
    await this.clickWhenReady(firstTopicLink);
    // トピック詳細ページに遷移するまで待機
    await this.page.waitForURL(/\/topics\/\d+/, { timeout: 10000 });
  }

  /**
   * ソート順を設定
   */
  async setSortOrder(sortBy: string): Promise<void> {
    const sortSelect = this.page.locator('select[name="sortBy"]');
    await this.waitForVisible(sortSelect);
    await sortSelect.selectOption(sortBy);
  }

  /**
   * ソートを適用
   */
  async applySorting(sortBy: string): Promise<void> {
    await this.setSortOrder(sortBy);
    await this.clickSearchButton();
    await this.page.waitForURL((url) => url.searchParams.has('sortBy'), { timeout: 5000 });
  }

  /**
   * トピックが読み込まれるまで待機
   */
  async waitForTopicsToLoad(): Promise<void> {
    await this.page.waitForSelector('a[aria-label*="お題"]', { timeout: 15000 });
    await this.waitForLoadingComplete();
  }

  /**
   * トピックの総数を取得
   */
  async getTopicCount(): Promise<number> {
    const topics = this.page.locator('a[aria-label*="お題"]');
    return await topics.count();
  }
}