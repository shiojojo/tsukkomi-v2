/**
 * テストデータの定義と管理
 */

// テストで使用する定数
export const TEST_CONSTANTS = {
  USERS: {
    HS: 'HS',
    TEST: 'test',
  },
  SELECTORS: {
    APP_TITLE: 'Tsukkomi V2',
    HOMEPAGE_TITLE: 'Tsukkomi — 今日のお題',
    LOGIN_DEV_TEXT: 'ログイン（開発用）',
    SELECT_BUTTON: '選択',
    DETAILS_BUTTON: '詳細',
    TOPIC_LIST: 'お題一覧',
    ANSWER_LIST: '回答一覧',
    FAVORITES: 'お気に入り',
    SEARCH_BUTTON: '検索',
  },
  SORT_OPTIONS: {
    NEWEST: 'newest',
    OLDEST: 'oldest',
    SCORE: 'score',
  },
  MESSAGES: {
    SUCCESS: '成功',
    OPERATION_COMPLETED: '操作が完了しました',
  },
} as const;

/**
 * テストデータのセットアップを行う関数
 * テスト実行前に必要なデータを準備する
 */
export async function setupTestData(): Promise<void> {
  // 現在の実装では、実際のDB操作は行わず、
  // テスト内で必要なデータが既に存在することを前提とする
  // 将来的に実際のテストデータ投入が必要になった場合はここに実装

  console.log('Test data setup completed');
}

/**
 * テストデータのクリーンアップを行う関数
 * テスト実行後にデータを元に戻す
 */
export async function cleanupTestData(): Promise<void> {
  // 現在の実装では、実際のDB操作は行わず、
  // テスト内で変更したデータはテスト終了後に自然にリセットされることを前提とする
  // 将来的に実際のデータクリーンアップが必要になった場合はここに実装

  console.log('Test data cleanup completed');
}

/**
 * テスト実行前の共通セットアップ
 */
export async function globalSetup(): Promise<void> {
  console.log('Global test setup starting...');
  await setupTestData();
  console.log('Global test setup completed');
}

/**
 * テスト実行後の共通クリーンアップ
 */
export async function globalTeardown(): Promise<void> {
  console.log('Global test teardown starting...');
  await cleanupTestData();
  console.log('Global test teardown completed');
}