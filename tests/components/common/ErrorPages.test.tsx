import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  NotFoundPage,
  ServerErrorPage,
  GenericErrorPage,
} from '~/components/common/ErrorPages';

// Mock react-router Link component
vi.mock('react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// Mock window.history.back and window.location.reload
const mockHistoryBack = vi.fn();
const mockLocationReload = vi.fn();

vi.spyOn(window.history, 'back').mockImplementation(mockHistoryBack);

// Mock window.location.reload using Object.defineProperty
Object.defineProperty(window, 'location', {
  value: { reload: mockLocationReload },
  writable: true,
});

describe('ErrorPages', () => {
  describe('NotFoundPage', () => {
    it('renders 404 error page with correct content', () => {
      render(<NotFoundPage />);

      expect(
        screen.getByText('404 - ページが見つかりません')
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'お探しのページは存在しないか、移動した可能性があります。'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /ホームに戻る/i })
      ).toBeInTheDocument();
      expect(screen.getAllByRole('button')[1]).toHaveTextContent('戻る');
      expect(screen.getAllByRole('button')).toHaveLength(2); // ホームに戻る (Link) and 戻る (Button)
    });

    it('navigates to home when home button is clicked', () => {
      render(<NotFoundPage />);

      const homeLink = screen.getByRole('link', { name: /ホームに戻る/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });

  describe('ServerErrorPage', () => {
    it('renders 500 error page with correct content', () => {
      render(<ServerErrorPage />);

      expect(screen.getByText('500 - サーバーエラー')).toBeInTheDocument();
      expect(
        screen.getByText(
          'サーバーで問題が発生しました。しばらく経ってから再度お試しください。'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /ホームに戻る/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /ページを再読み込み/i })
      ).toBeInTheDocument();
    });

    it('navigates to home when home button is clicked', () => {
      render(<ServerErrorPage />);

      const homeLink = screen.getByRole('link', { name: /ホームに戻る/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('reloads page when reload button is clicked', () => {
      render(<ServerErrorPage />);

      const reloadButton = screen.getByRole('button', {
        name: /ページを再読み込み/i,
      });
      fireEvent.click(reloadButton);

      expect(mockLocationReload).toHaveBeenCalledTimes(1);
    });
  });

  describe('GenericErrorPage', () => {
    it('renders generic error page with provided status and message', () => {
      render(<GenericErrorPage status={403} message="Forbidden" />);

      expect(screen.getByText('403 - Forbidden')).toBeInTheDocument();
      expect(
        screen.getByText(
          'エラーが発生しました。しばらく経ってから再度お試しください。'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /ホームに戻る/i })
      ).toBeInTheDocument();
      expect(screen.getAllByRole('button')[1]).toHaveTextContent('戻る');
      expect(screen.getAllByRole('button')).toHaveLength(2); // ホームに戻る (Link) and 戻る (Button)
    });

    it('navigates to home when home button is clicked', () => {
      render(<GenericErrorPage status={404} message="Not Found" />);

      const homeLink = screen.getByRole('link', { name: /ホームに戻る/i });
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });
});
