import React from 'react';

// Mock ResizeObserver for test environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock useIdentity hook
vi.mock('~/hooks/common/useIdentity', () => ({
  useIdentity: vi.fn(),
}));

// Mock react-router NavLink
vi.mock('react-router', () => ({
  NavLink: (props: {
    to: string;
    children: React.ReactNode;
    className?: string | (({ isActive }: { isActive: boolean }) => string);
    onClick?: () => void;
  }) => (
    <a
      href={props.to}
      data-testid={`nav-link-${props.to.replace(/^\//, '').replace(/\//g, '-') || 'home'}`}
      className={
        typeof props.className === 'function'
          ? props.className({ isActive: false })
          : props.className
      }
      onClick={props.onClick}
    >
      {props.children}
    </a>
  ),
  useLocation: vi.fn(() => ({ pathname: '/' })),
}));

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResponsiveNav from '~/components/layout/ResponsiveNav';
import { useIdentity } from '~/hooks/common/useIdentity';

// Mock ThemeToggle component
vi.mock('~/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}));

describe('ResponsiveNav', () => {
  beforeEach(() => {
    vi.mocked(useIdentity).mockReturnValue({
      mainId: null,
      mainName: null,
      subId: null,
      subName: null,
      effectiveId: null,
      effectiveName: null,
      refresh: vi.fn(),
    });

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders navigation with correct role and aria-label', () => {
    render(<ResponsiveNav />);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Main');
  });

  it('renders all navigation items', () => {
    render(<ResponsiveNav />);

    // Mobile navigation items
    const homeLinks = screen.getAllByTestId('nav-link-home');
    expect(homeLinks).toHaveLength(2); // Desktop brand link and mobile nav link
    expect(screen.getByTestId('nav-link-answers')).toBeInTheDocument();
    expect(
      screen.getByTestId('nav-link-answers-favorites')
    ).toBeInTheDocument();
    expect(screen.getByTestId('nav-link-topics')).toBeInTheDocument();
  });

  it('renders navigation labels correctly', () => {
    render(<ResponsiveNav />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('検索')).toBeInTheDocument();
    expect(screen.getByText('お気に')).toBeInTheDocument();
    expect(screen.getByText('お題')).toBeInTheDocument();
  });

  it('renders brand name on desktop', () => {
    render(<ResponsiveNav />);

    expect(screen.getByText('Tsukkomi V2')).toBeInTheDocument();
  });

  it('renders login link when user is not authenticated', () => {
    render(<ResponsiveNav />);

    const loginLinks = screen.getAllByText('ログイン');
    expect(loginLinks).toHaveLength(2); // Mobile and desktop
  });

  it('renders user badge when user is authenticated', () => {
    vi.mocked(useIdentity).mockReturnValue({
      mainId: '1',
      mainName: 'User',
      subId: '2',
      subName: 'Test',
      effectiveId: '2',
      effectiveName: 'Test User',
      refresh: vi.fn(),
    });

    render(<ResponsiveNav />);

    const testTexts = screen.getAllByText('Test');
    expect(testTexts).toHaveLength(2); // Mobile and desktop
    const userTexts = screen.getAllByText('(User)');
    expect(userTexts).toHaveLength(1); // Only desktop
  });

  it('renders theme toggle on desktop', () => {
    render(<ResponsiveNav />);

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('renders mobile user button when authenticated', () => {
    vi.mocked(useIdentity).mockReturnValue({
      mainId: '1',
      mainName: 'User',
      subId: '2',
      subName: 'Test',
      effectiveId: '2',
      effectiveName: 'Test User',
      refresh: vi.fn(),
    });

    render(<ResponsiveNav />);

    // Mobile user button should show truncated name
    const testTexts = screen.getAllByText('Test');
    expect(testTexts).toHaveLength(2); // Mobile and desktop
  });

  it('applies responsive classes for mobile navigation', () => {
    render(<ResponsiveNav />);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveClass(
      'fixed',
      'inset-x-0',
      'bottom-0',
      'md:top-0',
      'md:bottom-auto'
    );
  });

  it('renders icons for each navigation item', () => {
    render(<ResponsiveNav />);

    // Check that SVG icons are rendered (we can't easily test specific icons without more complex mocking)
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
