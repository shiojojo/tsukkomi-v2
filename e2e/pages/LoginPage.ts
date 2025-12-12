import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * ログインページのPage Object
 */
export class LoginPage extends BasePage {
  // ページ要素のセレクター
  private readonly loginDevText = 'ログイン（開発用）';
  private readonly selectButton = '選択';
  private readonly detailsButton = '詳細';

  constructor(page: Page) {
    super(page);
  }

  /**
   * ログインページに移動
   */
  async gotoLoginPage(): Promise<void> {
    await this.goto('/login');
    await this.waitForTitle(/Tsukkomi V2/);
    await this.waitForText(this.loginDevText);
  }

  /**
   * 指定されたユーザーを選択
   */
  async selectUser(userName: string): Promise<void> {
    // メインユーザー一覧内の特定のユーザーコンテナを見つける
    const userContainer = this.page.locator('h2:has-text("メインユーザー一覧")').locator('xpath=following-sibling::ul').locator('li').filter({ hasText: userName });
    await this.waitForVisible(userContainer);

    // 選択ボタンをクリック
    const selectButton = userContainer.locator(`button:has-text("${this.selectButton}")`);
    await this.clickWhenReady(selectButton);

    // ホームページにリダイレクトされるまで待機
    await this.waitForURL('/');
  }

  /**
   * HSユーザーの詳細を表示
   */
  async openHSUserDetails(): Promise<void> {
    // メインユーザー一覧内のHSユーザーコンテナを見つける
    const hsUserContainer = this.page.locator('h2:has-text("メインユーザー一覧")').locator('xpath=following-sibling::ul').locator('li').filter({ hasText: 'HS' });
    await this.waitForVisible(hsUserContainer);

    const detailsButton = hsUserContainer.locator(`button:has-text("${this.detailsButton}")`);
    await this.clickWhenReady(detailsButton);
  }

  /**
   * サブユーザーを選択
   */
  async selectSubUser(subUserName: string): Promise<void> {
    // サブユーザー名のボタンをクリック
    const subUserButton = this.page.locator(`text=${subUserName}`).locator('xpath=following-sibling::button');
    await this.clickWhenReady(subUserButton);

    // ホームページにリダイレクトされるまで待機
    await this.waitForURL('/');
  }

  /**
   * HSユーザーとしてログインし、サブユーザーtestに切り替え
   */
  async loginAsTestUser(): Promise<void> {
    await this.gotoLoginPage();

    // HSユーザーを選択
    await this.selectUser('HS');

    // HSユーザーの詳細を開く
    await this.gotoLoginPage();
    await this.openHSUserDetails();

    // testサブユーザーを選択
    await this.selectSubUser('test');
  }

  /**
   * ナビゲーションバーに指定されたユーザーが表示されているか確認
   */
  async verifyUserInHeader(userName: string): Promise<void> {
    // Desktopではヘッダーのユーザーバッジ（md:flex領域）に表示される。
    // モバイル用のフッター要素はmd:hiddenで不可視のため、ヘッダー側を優先して探索する。
    const headerArea = this.page.locator('nav[aria-label="Main"] .md\\:flex');
    const userBadgeLink = headerArea.locator('a[href="/me"]');
    const userInHeader = userBadgeLink.filter({ hasText: userName }).first();
    await this.waitForVisible(userInHeader);
  }
}