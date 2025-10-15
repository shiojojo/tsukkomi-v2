import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResponsiveNav from '~/components/layout/ResponsiveNav';

// Mock react-router NavLink
vi.mock('react-router', () => ({
  NavLink: (props: any) => (
    <a
      href={props.to}
      data-testid={`nav-link-${props.to.replace('/', '').replace('/', '-') || 'home'}`}
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
}));

// Mock useIdentity hook
vi.mock('~/hooks/common/useIdentity', () => ({
  useIdentity: vi.fn(),
}));

// Mock ThemeToggle component
vi.mock('~/components/ui/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}));

describe('ResponsiveNav', () => {
  const mockUseIdentity = vi.mocked(
    require('~/hooks/common/useIdentity').useIdentity
  );

  beforeEach(() => {
    // Reset mocks
    mockUseIdentity.mockReturnValue({
      effectiveName: null,
      subName: null,
      mainName: null,
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

    expect(screen.getByTestId('nav-link-home')).toBeInTheDocument();
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

    expect(screen.getByText('ログイン')).toBeInTheDocument();
  });

  it('renders user badge when user is authenticated', () => {
    mockUseIdentity.mockReturnValue({
      effectiveName: 'Test User',
      subName: 'Test',
      mainName: 'User',
    });

    render(<ResponsiveNav />);

    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('(User)')).toBeInTheDocument();
  });

  it('renders theme toggle on desktop', () => {
    render(<ResponsiveNav />);

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  it('renders mobile user button when authenticated', () => {
    mockUseIdentity.mockReturnValue({
      effectiveName: 'Test User',
      subName: 'Test',
      mainName: 'User',
    });

    render(<ResponsiveNav />);

    // Mobile user button should show truncated name
    expect(screen.getByText('Test')).toBeInTheDocument();
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

  it('sets up CSS variable for header height', () => {
    // Mock getComputedStyle and offsetHeight
    const mockElement = {
      offsetHeight: 64,
    };

    // Mock document.documentElement
    Object.defineProperty(document, 'documentElement', {
      writable: true,
      value: {
        style: {
          setProperty: vi.fn(),
        },
      },
    });

    render(<ResponsiveNav />);

    // The effect should run and set the CSS variable
    // We can't easily test the exact behavior without more complex setup
    expect(document.documentElement.style.setProperty).toHaveBeenCalled();
  });
});
