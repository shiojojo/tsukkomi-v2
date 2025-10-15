import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { ErrorBoundary } from '~/components/common/ErrorBoundary';

// Component that throws an error
function ErrorComponent(): never {
  throw new Error('Test error');
}

// Component that renders normally
function NormalComponent() {
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  // Mock console.error to avoid noise in test output
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('renders default error fallback when error occurs', async () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    });

    // Error message appears in the main content only (details contains stack trace)
    // Error message appears in main content and details section
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ページを再読み込み/i })
    ).toBeInTheDocument();
  });

  it('renders custom fallback when provided', async () => {
    const customFallback = vi.fn((error, errorInfo) => (
      <div data-testid="custom-fallback">Custom error: {error.message}</div>
    ));

    render(
      <ErrorBoundary fallback={customFallback}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    });

    expect(screen.getByText('Custom error: Test error')).toBeInTheDocument();
    expect(customFallback).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('shows error details when showDetails is true', async () => {
    render(
      <ErrorBoundary showDetails>
        <ErrorComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    });

    // Should show error stack or component stack
    expect(screen.getAllByText(/Test error/)).toHaveLength(2);
  });

  it('logs error in development mode', async () => {
    const originalEnv = import.meta.env.DEV;
    import.meta.env.DEV = true;

    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.any(Error),
        expect.any(Object)
      );
    });

    import.meta.env.DEV = originalEnv;
  });
});
