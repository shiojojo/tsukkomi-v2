import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthError,
  PermissionError,
  NotFoundError,
  ServerError,
  createErrorResponse,
  handleError,
  getUserFriendlyErrorMessage,
} from '~/lib/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('正しいプロパティで初期化される', () => {
      const error = new AppError(400, 'Test message', 'TEST_CODE');

      expect(error.status).toBe(400);
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AppError');
    });

    it('code がオプションである', () => {
      const error = new AppError(500, 'Test message');

      expect(error.status).toBe(500);
      expect(error.message).toBe('Test message');
      expect(error.code).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('正しいプロパティで初期化される', () => {
      const error = new ValidationError('Invalid input', 'email');

      expect(error.status).toBe(400);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('email');
    });
  });

  describe('AuthError', () => {
    it('デフォルトメッセージで初期化される', () => {
      const error = new AuthError();

      expect(error.status).toBe(401);
      expect(error.message).toBe('認証が必要です');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.name).toBe('AuthError');
    });

    it('カスタムメッセージで初期化される', () => {
      const error = new AuthError('Custom auth error');

      expect(error.message).toBe('Custom auth error');
    });
  });

  describe('PermissionError', () => {
    it('デフォルトメッセージで初期化される', () => {
      const error = new PermissionError();

      expect(error.status).toBe(403);
      expect(error.message).toBe('権限がありません');
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.name).toBe('PermissionError');
    });
  });

  describe('NotFoundError', () => {
    it('デフォルトメッセージで初期化される', () => {
      const error = new NotFoundError();

      expect(error.status).toBe(404);
      expect(error.message).toBe('リソースが見つかりません');
      expect(error.code).toBe('NOT_FOUND_ERROR');
      expect(error.name).toBe('NotFoundError');
    });

    it('カスタムリソース名で初期化される', () => {
      const error = new NotFoundError('ユーザー');

      expect(error.message).toBe('ユーザーが見つかりません');
    });
  });

  describe('ServerError', () => {
    it('デフォルトメッセージで初期化される', () => {
      const error = new ServerError();

      expect(error.status).toBe(500);
      expect(error.message).toBe('サーバーエラーが発生しました');
      expect(error.code).toBe('SERVER_ERROR');
      expect(error.name).toBe('ServerError');
    });
  });
});

describe('createErrorResponse', () => {
  it('正しいResponseをthrowする', () => {
    expect(() => {
      createErrorResponse(400, 'Bad request', 'BAD_REQUEST');
    }).toThrow(Response);

    try {
      createErrorResponse(400, 'Bad request', 'BAD_REQUEST');
    } catch (error) {
      const response = error as Response;
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    }
  });
});

describe('handleError', () => {
  it('AppErrorをResponseに変換する', () => {
    const appError = new ValidationError('Invalid input');
    const response = handleError(appError);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('Responseはそのまま返す', () => {
    const originalResponse = new Response('Not found', { status: 404 });
    const response = handleError(originalResponse);

    expect(response).toBe(originalResponse);
  });

  it('予期せぬエラーを500 Responseに変換する', () => {
    const error = new Error('Unexpected error');
    const response = handleError(error);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('getUserFriendlyErrorMessage', () => {
  it('AppErrorのメッセージを返す', () => {
    const error = new ValidationError('Custom validation error');
    const message = getUserFriendlyErrorMessage(error);

    expect(message).toBe('Custom validation error');
  });

  it('Responseのステータスに基づいてメッセージを返す', () => {
    expect(getUserFriendlyErrorMessage(new Response('', { status: 400 }))).toBe('入力内容を確認してください');
    expect(getUserFriendlyErrorMessage(new Response('', { status: 401 }))).toBe('ログインが必要です');
    expect(getUserFriendlyErrorMessage(new Response('', { status: 403 }))).toBe('権限がありません');
    expect(getUserFriendlyErrorMessage(new Response('', { status: 404 }))).toBe('ページが見つかりません');
    expect(getUserFriendlyErrorMessage(new Response('', { status: 500 }))).toBe('サーバーエラーが発生しました');
    expect(getUserFriendlyErrorMessage(new Response('', { status: 418 }))).toBe('エラーが発生しました');
  });

  it('予期せぬエラーのデフォルトメッセージを返す', () => {
    const error = new Error('Some error');
    const message = getUserFriendlyErrorMessage(error);

    expect(message).toBe('予期せぬエラーが発生しました');
  });
});