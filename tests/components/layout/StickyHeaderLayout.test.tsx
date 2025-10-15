// Mock useBrowserDetection hook
vi.mock('~/hooks/common/useBrowserDetection', () => ({
  useBrowserDetection: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StickyHeaderLayout from '~/components/layout/StickyHeaderLayout';
import { useBrowserDetection } from '~/hooks/common/useBrowserDetection';

describe('StickyHeaderLayout', () => {
  beforeEach(() => {
    // Reset mocks
    vi.mocked(useBrowserDetection).mockReturnValue(false);
  });

  const baseProps = {
    header: <div data-testid="header">Header Content</div>,
    children: <div data-testid="children">Children Content</div>,
    className: 'test-class',
    contentRef: { current: null },
  };

  it('renders header and children', () => {
    render(<StickyHeaderLayout {...baseProps} />);

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.getByText('Header Content')).toBeInTheDocument();
    expect(screen.getByText('Children Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    vi.mocked(useBrowserDetection).mockReturnValue(false);
    render(<StickyHeaderLayout {...baseProps} />);

    const container =
      screen.getByTestId('children').parentElement?.parentElement;
    expect(container).toHaveClass('test-class');
  });

  it('renders with grid layout when useDocumentScroll is false', () => {
    vi.mocked(useBrowserDetection).mockReturnValue(false);

    render(<StickyHeaderLayout {...baseProps} />);

    const container =
      screen.getByTestId('children').parentElement?.parentElement;
    expect(container).toHaveStyle({
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
    });
  });

  it('renders with document scroll layout when useDocumentScroll is true', () => {
    vi.mocked(useBrowserDetection).mockReturnValue(true);

    render(<StickyHeaderLayout {...baseProps} />);

    const container =
      screen.getByTestId('children').parentElement?.parentElement;
    expect(container).toHaveStyle({
      minHeight: 'calc(var(--vh, 1vh) * 100)',
    });
  });

  it('applies correct styles to header in document scroll mode', () => {
    vi.mocked(useBrowserDetection).mockReturnValue(true);

    render(<StickyHeaderLayout {...baseProps} />);

    const headerContainer = screen.getByTestId('header').parentElement;
    expect(headerContainer).toHaveClass('sticky');
    expect(headerContainer).toHaveStyle({
      top: 0,
      paddingTop: 'var(--app-header-height, 0px)',
      zIndex: 30,
    });
  });

  it('applies correct styles to header in grid mode', () => {
    vi.mocked(useBrowserDetection).mockReturnValue(false);

    render(<StickyHeaderLayout {...baseProps} />);

    const headerContainer = screen.getByTestId('header').parentElement;
    expect(headerContainer).toHaveStyle({
      paddingTop: 'var(--app-header-height, 0px)',
      zIndex: 30,
    });
  });

  it('applies correct styles to content area', () => {
    render(<StickyHeaderLayout {...baseProps} />);

    const contentArea = screen.getByTestId('children').parentElement;
    expect(contentArea).toHaveClass(
      'overflow-auto',
      'pb-20',
      'sm:pb-28',
      'min-w-0'
    );
  });

  it('sets up viewport height variable', () => {
    render(<StickyHeaderLayout {...baseProps} />);

    const container =
      screen.getByTestId('children').parentElement?.parentElement;
    expect(container).toHaveStyle({
      height: 'calc(var(--vh, 1vh) * 100)',
    });
  });

  it('handles missing className prop', () => {
    vi.mocked(useBrowserDetection).mockReturnValue(false);
    const propsWithoutClassName = { ...baseProps, className: undefined };
    render(<StickyHeaderLayout {...propsWithoutClassName} />);

    const container =
      screen.getByTestId('children').parentElement?.parentElement;
    expect(container).toHaveClass(
      'p-4',
      'max-w-3xl',
      'mx-auto',
      'overflow-hidden',
      'grid',
      'min-w-0'
    );
  });

  it('handles missing contentRef prop', () => {
    const propsWithoutRef = { ...baseProps, contentRef: undefined };
    render(<StickyHeaderLayout {...propsWithoutRef} />);

    // Should still render without errors
    expect(screen.getByTestId('children')).toBeInTheDocument();
  });
});
