import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from '~/components/common/ErrorBoundary';

// Component that throws an error
function ErrorThrowingComponent() {
  throw new Error('Test error');
  return <div>Never reached</div>; // This line won't execute
}

// Component that doesn't throw
function NormalComponent() {
  return <div>Normal component</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal component')).toBeInTheDocument();
  });

  it('renders error fallback when an error occurs', () => {
    // Mock console.error to avoid noise in test output
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('shows error details in development mode', () => {
    // Mock import.meta.env.DEV
    const originalEnv = import.meta.env.DEV;
    import.meta.env.DEV = true;

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ErrorBoundary showDetails={true}>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('エラー詳細 (開発者向け)')).toBeInTheDocument();

    // Restore original env
    import.meta.env.DEV = originalEnv;
    consoleError.mockRestore();
  });

  it('calls custom fallback when provided', () => {
    const customFallback = vi.fn(() => <div>Custom error fallback</div>);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={customFallback}>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(customFallback).toHaveBeenCalled();
    expect(screen.getByText('Custom error fallback')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('handles reload button click', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByText('ページを再読み込み');
    fireEvent.click(reloadButton);

    expect(reloadMock).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('handles back button click', () => {
    const backMock = vi.fn();
    Object.defineProperty(window.history, 'back', {
      value: backMock,
      writable: true,
    });

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    const backButton = screen.getByText('戻る');
    fireEvent.click(backButton);

    expect(backMock).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
