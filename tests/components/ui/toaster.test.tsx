import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toaster } from '~/components/ui/toaster';
import { useToast } from '~/hooks/common/useToast';

// Mock the useToast hook
vi.mock('~/hooks/common/useToast', () => ({
  useToast: vi.fn(),
}));

const mockUseToast = vi.mocked(useToast);

describe('Toaster', () => {
  it('renders Toaster component', () => {
    mockUseToast.mockReturnValue({
      toasts: [],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });

    render(<Toaster />);
    // Toaster always renders ToastProvider and ToastViewport
    expect(document.querySelector('[role="region"]')).toBeInTheDocument();
  });

  it('renders single toast', () => {
    mockUseToast.mockReturnValue({
      toasts: [
        {
          id: '1',
          title: 'Test Toast',
          description: 'Test description',
        },
      ],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });

    render(<Toaster />);

    expect(screen.getByText('Test Toast')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    mockUseToast.mockReturnValue({
      toasts: [
        {
          id: '1',
          title: 'First Toast',
          description: 'First description',
        },
        {
          id: '2',
          title: 'Second Toast',
          description: 'Second description',
        },
      ],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });

    render(<Toaster />);

    expect(screen.getByText('First Toast')).toBeInTheDocument();
    expect(screen.getByText('First description')).toBeInTheDocument();
    expect(screen.getByText('Second Toast')).toBeInTheDocument();
    expect(screen.getByText('Second description')).toBeInTheDocument();
  });

  it('renders toast with action', () => {
    const action = <button>Action Button</button>;

    mockUseToast.mockReturnValue({
      toasts: [
        {
          id: '1',
          title: 'Toast with Action',
          description: 'Description',
          action,
        },
      ],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });

    render(<Toaster />);

    expect(screen.getByText('Action Button')).toBeInTheDocument();
  });

  it('renders toast without description', () => {
    mockUseToast.mockReturnValue({
      toasts: [
        {
          id: '1',
          title: 'Toast without description',
        },
      ],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });

    render(<Toaster />);

    expect(screen.getByText('Toast without description')).toBeInTheDocument();
    // When description is undefined, it should not render ToastDescription
    expect(screen.queryByText(/^Description$/i)).not.toBeInTheDocument();
  });

  it('renders toast without title', () => {
    mockUseToast.mockReturnValue({
      toasts: [
        {
          id: '1',
          description: 'Toast without title',
        },
      ],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });

    render(<Toaster />);

    expect(screen.getByText('Toast without title')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('passes additional props to Toast component', () => {
    mockUseToast.mockReturnValue({
      toasts: [
        {
          id: '1',
          title: 'Toast with props',
          variant: 'destructive' as const,
        },
      ],
      toast: vi.fn(),
      dismiss: vi.fn(),
    });

    render(<Toaster />);

    // The toast should render with the variant prop
    expect(screen.getByText('Toast with props')).toBeInTheDocument();
  });
});
