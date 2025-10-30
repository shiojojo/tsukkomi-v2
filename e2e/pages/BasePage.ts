import type { Page, Locator } from '@playwright/test';

/**
 * Page Object Modelの基底クラス
 * 共通の操作や待機処理を提供します
 */
export class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 指定されたURLに移動し、ページが完全に読み込まれるまで待機
   */
  async goto(url: string): Promise<void> {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 要素が表示されるまで待機
   */
  async waitForVisible(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * 要素がクリック可能になるまで待機してからクリック
   */
  async clickWhenReady(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
    await locator.click();
  }

  /**
   * テキストが表示されるまで待機
   */
  async waitForText(text: string, timeout = 10000): Promise<void> {
    await this.page.waitForSelector(`text=${text}`, { timeout });
  }

  /**
   * ページタイトルが期待値になるまで待機
   */
  async waitForTitle(title: string | RegExp, timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      (expectedTitle) => {
        const currentTitle = document.title;
        if (typeof expectedTitle === 'string') {
          return currentTitle === expectedTitle;
        }
        return expectedTitle.test(currentTitle);
      },
      title,
      { timeout }
    );
  }

  /**
   * URLが期待値を含むまで待機
   */
  async waitForURL(urlPattern: string | RegExp, timeout = 10000): Promise<void> {
    await this.page.waitForURL(urlPattern, { timeout });
  }

  /**
   * トーストメッセージが表示されるまで待機
   */
  async waitForToast(message: string, timeout = 5000): Promise<void> {
    await this.page.waitForSelector(`text=${message}`, { timeout });
  }

  /**
   * ローディング状態が完了するまで待機
   */
  async waitForLoadingComplete(timeout = 10000): Promise<void> {
    // 一般的なローディングインジケーターを待機
    try {
      await this.page.waitForSelector('[aria-label="Loading"]', {
        state: 'hidden',
        timeout: 2000
      });
    } catch {
      // ローディングインジケーターがない場合は何もしない
    }

    // ネットワークがアイドルになるまで待機
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * ページをリロードし、読み込み完了まで待機
   */
  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForLoadingComplete();
  }

  /**
   * 現在のURLを取得
   */
  getCurrentURL(): string {
    return this.page.url();
  }

  /**
   * 現在のページタイトルを取得
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }
}