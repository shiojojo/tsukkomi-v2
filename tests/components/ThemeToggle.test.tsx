import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeToggle } from '~/components/ui/ThemeToggle';
import { useThemeStore } from '~/lib/store';

// Mock the store
vi.mock('~/lib/store', () => ({
  useThemeStore: vi.fn(),
}));

const mockUseThemeStore = vi.mocked(useThemeStore);

describe('ThemeToggle', () => {
  it('renders light theme icon after mounting', async () => {
    mockUseThemeStore.mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
    });

    render(<ThemeToggle />);

    // Wait for component to mount and render the icon
    await waitFor(() => {
      const sunIcon = document.querySelector('svg');
      expect(sunIcon).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /テーマを切り替え/i });
    expect(button).not.toBeDisabled();
  });

  it('renders dark theme icon after mounting', async () => {
    mockUseThemeStore.mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
    });

    render(<ThemeToggle />);

    // Wait for component to mount and render the icon
    await waitFor(() => {
      const moonIcon = document.querySelector('svg');
      expect(moonIcon).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /テーマを切り替え/i });
    expect(button).not.toBeDisabled();
  });

  it('renders system theme icon after mounting', async () => {
    mockUseThemeStore.mockReturnValue({
      theme: 'system',
      setTheme: vi.fn(),
    });

    render(<ThemeToggle />);

    // Wait for component to mount and render the icon
    await waitFor(() => {
      const monitorIcon = document.querySelector('svg');
      expect(monitorIcon).toBeInTheDocument();
    });

    const button = screen.getByRole('button', { name: /テーマを切り替え/i });
    expect(button).not.toBeDisabled();
  });

  it('cycles through themes on click after mounting', async () => {
    const setTheme = vi.fn();
    mockUseThemeStore.mockReturnValue({
      theme: 'light',
      setTheme,
    });

    const { rerender } = render(<ThemeToggle />);

    // Wait for component to mount
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /テーマを切り替え/i });
      expect(button).not.toBeDisabled();
    });

    const button = screen.getByRole('button', { name: /テーマを切り替え/i });

    // Click to go to dark
    fireEvent.click(button);
    expect(setTheme).toHaveBeenCalledWith('dark');

    // Update mock for next state
    mockUseThemeStore.mockReturnValue({
      theme: 'dark',
      setTheme,
    });
    rerender(<ThemeToggle />);

    // Click to go to system
    fireEvent.click(button);
    expect(setTheme).toHaveBeenCalledWith('system');

    // Update mock for next state
    mockUseThemeStore.mockReturnValue({
      theme: 'system',
      setTheme,
    });
    rerender(<ThemeToggle />);

    // Click to go back to light
    fireEvent.click(button);
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
