import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastProvider,
  ToastViewport,
} from '~/components/ui/toast';

describe('Toast', () => {
  it('renders Toast with default variant', () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Test Title</ToastTitle>
          <ToastDescription>Test Description</ToastDescription>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument(); // ToastClose
  });

  it('renders Toast with destructive variant', () => {
    render(
      <ToastProvider>
        <Toast variant="destructive" open>
          <ToastTitle>Error Title</ToastTitle>
          <ToastDescription>Error Description</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('Error Description')).toBeInTheDocument();
  });

  it('renders Toast with success variant', () => {
    render(
      <ToastProvider>
        <Toast variant="success" open>
          <ToastTitle>Success Title</ToastTitle>
          <ToastDescription>Success Description</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    expect(screen.getByText('Success Title')).toBeInTheDocument();
    expect(screen.getByText('Success Description')).toBeInTheDocument();
  });

  it('renders ToastTitle correctly', () => {
    render(<ToastTitle>Test Title</ToastTitle>);
    const title = screen.getByText('Test Title');
    expect(title).toHaveClass('text-xs', 'font-semibold');
  });

  it('renders ToastDescription correctly', () => {
    render(<ToastDescription>Test Description</ToastDescription>);
    const description = screen.getByText('Test Description');
    expect(description).toHaveClass('text-xs', 'opacity-90');
  });

  it('renders ToastClose with close button', () => {
    render(<ToastClose />);
    const closeButton = screen.getByRole('button');
    expect(closeButton).toBeInTheDocument();
    // Check if it has the X icon (lucide-react X)
    const svg = closeButton.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
