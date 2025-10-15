import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pagination } from '~/components/common/Pagination';

// Mock react-router's Link component
vi.mock('react-router', () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('Pagination', () => {
  const mockBuildHref = vi.fn((page: number) => `/page/${page}`);

  beforeEach(() => {
    mockBuildHref.mockClear();
  });

  it('renders nothing when pageCount is 1 or less', () => {
    const { container } = render(
      <Pagination currentPage={1} pageCount={1} buildHref={mockBuildHref} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders mobile pagination controls', () => {
    render(
      <Pagination currentPage={2} pageCount={5} buildHref={mockBuildHref} />
    );

    // Mobile controls should be present (there are two "前へ" links - mobile and desktop)
    expect(screen.getAllByText('前へ')).toHaveLength(2);
    expect(screen.getAllByText('次へ')).toHaveLength(2);
    expect(screen.getByText('ページ 2 / 5')).toBeInTheDocument();
  });

  it('renders desktop pagination with page numbers', () => {
    render(
      <Pagination currentPage={3} pageCount={10} buildHref={mockBuildHref} />
    );

    // Should show page numbers around current page
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(
      <Pagination currentPage={1} pageCount={5} buildHref={mockBuildHref} />
    );

    const prevLinks = screen.getAllByText('前へ');
    expect(prevLinks).toHaveLength(2);
    // Both mobile and desktop prev links should be disabled
    prevLinks.forEach(link => {
      expect(link.closest('a')).toHaveClass(
        'opacity-50',
        'pointer-events-none'
      );
    });
  });

  it('disables next button on last page', () => {
    render(
      <Pagination currentPage={5} pageCount={5} buildHref={mockBuildHref} />
    );

    const nextLinks = screen.getAllByText('次へ');
    expect(nextLinks).toHaveLength(2);
    // Both mobile and desktop next links should be disabled
    nextLinks.forEach(link => {
      expect(link.closest('a')).toHaveClass(
        'opacity-50',
        'pointer-events-none'
      );
    });
  });

  it('calls buildHref with correct page numbers', () => {
    render(
      <Pagination currentPage={3} pageCount={8} buildHref={mockBuildHref} />
    );

    // Check that buildHref was called for various pages
    expect(mockBuildHref).toHaveBeenCalledWith(1);
    expect(mockBuildHref).toHaveBeenCalledWith(2);
    expect(mockBuildHref).toHaveBeenCalledWith(3);
    expect(mockBuildHref).toHaveBeenCalledWith(4);
    expect(mockBuildHref).toHaveBeenCalledWith(5);
  });

  it('shows ellipsis for large page ranges', () => {
    render(
      <Pagination currentPage={5} pageCount={20} buildHref={mockBuildHref} />
    );

    // Should show ellipsis
    expect(screen.getAllByText('…')).toHaveLength(1);
  });

  it('applies custom className', () => {
    render(
      <Pagination
        currentPage={2}
        pageCount={5}
        buildHref={mockBuildHref}
        className="custom-pagination"
      />
    );

    // Mobile container should have custom class
    const mobileContainers = screen
      .getAllByText('前へ')
      .map(link => link.closest('.flex.items-center.justify-between'));
    expect(
      mobileContainers.some(container =>
        container?.classList.contains('custom-pagination')
      )
    ).toBe(true);
  });

  it('handles edge case with currentPage at boundaries', () => {
    // Test when currentPage is near the end
    render(
      <Pagination currentPage={8} pageCount={10} buildHref={mockBuildHref} />
    );

    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});
