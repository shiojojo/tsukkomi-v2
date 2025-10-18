import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FavoriteButton } from '~/components/common/FavoriteButton';

// Mock the hook
vi.mock('~/hooks/features/answers/useFavoriteButton', () => ({
  useFavoriteButton: vi.fn(),
}));

const mockUseFavoriteButton = vi.mocked(
  (await import('~/hooks/features/answers/useFavoriteButton')).useFavoriteButton
);

describe('FavoriteButton', () => {
  describe('Controlled mode', () => {
    it('renders unfavorited state correctly', () => {
      const handleToggle = vi.fn();

      render(<FavoriteButton favorited={false} onToggle={handleToggle} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toHaveAttribute('title', 'お気に入り');
      // Count is not displayed in button text, only in title
    });

    it('renders favorited state correctly', () => {
      const handleToggle = vi.fn();

      render(<FavoriteButton favorited={true} onToggle={handleToggle} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveAttribute('title', 'お気に入り解除');
      // Count is not displayed in button text, only in title
    });

    it('calls onToggle when clicked', () => {
      const handleToggle = vi.fn();

      render(<FavoriteButton favorited={false} onToggle={handleToggle} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Hook mode', () => {
    it('uses hook data when answerId is provided', () => {
      mockUseFavoriteButton.mockReturnValue({
        favorited: true,
        handleToggle: vi.fn(),
        isToggling: false,
      });

      render(<FavoriteButton answerId={123} initialFavorited={false} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveAttribute('title', 'お気に入り解除');
      // Count is not displayed in button text, only in title

      expect(mockUseFavoriteButton).toHaveBeenCalledWith({
        answerId: 123,
        initialFavorited: false,
        actionPath: undefined,
        loginRedirectPath: undefined,
        onFavoritedChange: undefined,
      });
    });

    it('passes additional props to hook', () => {
      const onFavoritedChange = vi.fn();

      mockUseFavoriteButton.mockReturnValue({
        favorited: false,
        handleToggle: vi.fn(),
        isToggling: false,
      });

      render(
        <FavoriteButton
          answerId={456}
          initialFavorited={true}
          actionPath="/api/favorite"
          loginRedirectPath="/login"
          onFavoritedChange={onFavoritedChange}
        />
      );

      expect(mockUseFavoriteButton).toHaveBeenCalledWith({
        answerId: 456,
        initialFavorited: true,
        actionPath: '/api/favorite',
        loginRedirectPath: '/login',
        onFavoritedChange,
      });
    });

    it('calls handleToggle from hook when clicked', () => {
      const handleToggle = vi.fn();

      mockUseFavoriteButton.mockReturnValue({
        favorited: false,
        handleToggle,
        isToggling: false,
      });

      render(<FavoriteButton answerId={789} initialFavorited={false} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleToggle).toHaveBeenCalledTimes(1);
    });
  });
});
