/**
 * エラーハンドリングの標準クラスとユーティリティ
 */

/**
 * アプリケーション固有のエラークラス
 */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * 認証エラー
 */
export class AuthError extends AppError {
  constructor(message: string = '認証が必要です') {
    super(401, message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

/**
 * 権限エラー
 */
export class PermissionError extends AppError {
  constructor(message: string = '権限がありません') {
    super(403, message, 'PERMISSION_ERROR');
    this.name = 'PermissionError';
  }
}

/**
 * リソース未発見エラー
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'リソース') {
    super(404, `${resource}が見つかりません`, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

/**
 * サーバーエラー
 */
export class ServerError extends AppError {
  constructor(message: string = 'サーバーエラーが発生しました') {
    super(500, message, 'SERVER_ERROR');
    this.name = 'ServerError';
  }
}

/**
 * エラーレスポンスを作成するユーティリティ関数
 */
export function createErrorResponse(status: number, message: string, code?: string) {
  throw new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * エラーを標準化されたレスポンスに変換
 */
export function handleError(error: unknown): Response {
  if (error instanceof AppError) {
    return new Response(JSON.stringify({
      error: error.message,
      code: error.code
    }), {
      status: error.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (error instanceof Response) {
    return error;
  }

  // 予期せぬエラー
  console.error('Unexpected error:', error);
  return new Response(JSON.stringify({
    error: '予期せぬエラーが発生しました',
    code: 'UNEXPECTED_ERROR'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * エラーメッセージをユーザーフレンドリーに変換
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Response) {
    switch (error.status) {
      case 400:
        return '入力内容を確認してください';
      case 401:
        return 'ログインが必要です';
      case 403:
        return '権限がありません';
      case 404:
        return 'ページが見つかりません';
      case 500:
        return 'サーバーエラーが発生しました';
      default:
        return 'エラーが発生しました';
    }
  }

  return '予期せぬエラーが発生しました';
}