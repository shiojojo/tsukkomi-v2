import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NotFound from '~/routes/404';

// Mock NotFoundPage component
vi.mock('~/components/common/ErrorPages', () => ({
  NotFoundPage: () => (
    <div data-testid="not-found-page">404 - Page Not Found</div>
  ),
}));

describe('404 Route', () => {
  it('renders NotFoundPage component', () => {
    render(<NotFound />);

    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByText('404 - Page Not Found')).toBeInTheDocument();
  });
});
