import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Chromeのみを使用（安定性向上のため）
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
    // ビデオ記録を失敗時のみに制限（ストレージ節約）
    video: 'retain-on-failure',
    // スクリーンショットを失敗時のみに制限
    screenshot: 'only-on-failure',
    // トレースを有効化（デバッグ用）
    trace: 'retain-on-failure',
    // アクションタイムアウトを適切に設定
    actionTimeout: 10000,
    // ナビゲーションタイムアウト
    navigationTimeout: 30000,
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    // サーバー起動のタイムアウトを延長
    timeout: 120000,
  },
  // テストタイムアウトを延長
  timeout: 60000,
  expect: {
    // アサーションタイムアウト
    timeout: 10000,
  },
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    // コンソール出力も有効化
    ['line'],
  ],
  // 並列実行を無効化（安定性確保のため）
  workers: 1,
  // リトライ設定
  retries: process.env.CI ? 2 : 0,
  // テスト実行順序を固定
  fullyParallel: false,
});