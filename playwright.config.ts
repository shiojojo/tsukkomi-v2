import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
    video: 'retain-on-failure', // テスト失敗時に動画を保存
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  timeout: 60000, // 60 seconds for long-running tests
  reporter: [
    ['html'], // HTMLレポートを生成
    ['json', { outputFile: 'test-results/results.json' }], // JSONレポート
  ],
});