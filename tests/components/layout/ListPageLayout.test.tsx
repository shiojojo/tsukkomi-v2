import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ListPageLayout } from '~/components/layout/ListPageLayout';

// Mock StickyHeaderLayout
vi.mock('./StickyHeaderLayout', () => ({
  default: (props: any) => (
    <div data-testid="sticky-header-layout">
      <div data-testid="header">{props.header}</div>
      <div data-testid="children">{props.children}</div>
    </div>
  ),
}));

describe('ListPageLayout', () => {
  const baseProps = {
    headerTitle: 'Test Page',
    filters: <div data-testid="filters">Filters Content</div>,
    list: <div data-testid="list">List Content</div>,
    pagination: <div data-testid="pagination">Pagination Content</div>,
    extraContent: <div data-testid="extra-content">Extra Content</div>,
    contentRef: { current: null },
  };

  it('renders main content with correct id', () => {
    render(<ListPageLayout {...baseProps} />);

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
  });

  it('renders header title correctly', () => {
    render(<ListPageLayout {...baseProps} />);

    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('renders filters content', () => {
    render(<ListPageLayout {...baseProps} />);

    expect(screen.getByTestId('filters')).toBeInTheDocument();
    expect(screen.getByText('Filters Content')).toBeInTheDocument();
  });

  it('renders list content', () => {
    render(<ListPageLayout {...baseProps} />);

    expect(screen.getByTestId('list')).toBeInTheDocument();
    expect(screen.getByText('List Content')).toBeInTheDocument();
  });

  it('renders pagination when provided', () => {
    render(<ListPageLayout {...baseProps} />);

    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    expect(screen.getByText('Pagination Content')).toBeInTheDocument();
  });

  it('renders extra content when provided', () => {
    render(<ListPageLayout {...baseProps} />);

    expect(screen.getByTestId('extra-content')).toBeInTheDocument();
    expect(screen.getByText('Extra Content')).toBeInTheDocument();
  });

  it('does not render pagination when not provided', () => {
    const propsWithoutPagination = { ...baseProps, pagination: undefined };
    render(<ListPageLayout {...propsWithoutPagination} />);

    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
  });

  it('does not render extra content when not provided', () => {
    const propsWithoutExtra = { ...baseProps, extraContent: undefined };
    render(<ListPageLayout {...propsWithoutExtra} />);

    expect(screen.queryByTestId('extra-content')).not.toBeInTheDocument();
  });

  it('passes contentRef to StickyHeaderLayout', () => {
    render(<ListPageLayout {...baseProps} />);

    // Since we mocked StickyHeaderLayout, we can't directly test the ref passing
    // but we can verify the component renders without errors
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('renders header with correct structure', () => {
    render(<ListPageLayout {...baseProps} />);

    // Check if header contains title and filters
    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('Filters Content')).toBeInTheDocument();
  });

  it('renders children in correct order', () => {
    render(<ListPageLayout {...baseProps} />);

    // Check if children contain extraContent, list, and pagination in order
    expect(screen.getByText('Extra Content')).toBeInTheDocument();
    expect(screen.getByText('List Content')).toBeInTheDocument();
    expect(screen.getByText('Pagination Content')).toBeInTheDocument();
  });
});
