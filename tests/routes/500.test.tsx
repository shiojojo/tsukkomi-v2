import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ServerError from '~/routes/500';

// Mock ServerErrorPage component
vi.mock('~/components/common/ErrorPages', () => ({
  ServerErrorPage: () => (
    <div data-testid="server-error-page">500 - Internal Server Error</div>
  ),
}));

describe('500 Route', () => {
  it('renders ServerErrorPage component', () => {
    render(<ServerError />);

    expect(screen.getByTestId('server-error-page')).toBeInTheDocument();
    expect(screen.getByText('500 - Internal Server Error')).toBeInTheDocument();
  });
});
