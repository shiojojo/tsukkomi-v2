import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NumericVoteButtons } from '~/components/common/NumericVoteButtons';

// Mock the hook
vi.mock('~/hooks/features/answers/useNumericVoteButtons', () => ({
  useNumericVoteButtons: vi.fn(),
}));

const mockUseNumericVoteButtons = vi.mocked(
  (await import('~/hooks/features/answers/useNumericVoteButtons'))
    .useNumericVoteButtons
);

describe('NumericVoteButtons', () => {
  describe('Controlled mode', () => {
    it('renders vote buttons with correct counts and no selection', () => {
      const handleVote = vi.fn();

      render(
        <NumericVoteButtons
          selection={null}
          counts={{ level1: 5, level2: 3, level3: 1 }}
          onVote={handleVote}
        />
      );

      expect(screen.getByRole('button', { name: '投票1' })).toHaveTextContent(
        '1'
      );
      expect(screen.getByRole('button', { name: '投票2' })).toHaveTextContent(
        '2'
      );
      expect(screen.getByRole('button', { name: '投票3' })).toHaveTextContent(
        '3'
      );

      // No button should be active
      expect(screen.getByRole('button', { name: '投票1' })).not.toHaveAttribute(
        'data-active'
      );
      expect(screen.getByRole('button', { name: '投票2' })).not.toHaveAttribute(
        'data-active'
      );
      expect(screen.getByRole('button', { name: '投票3' })).not.toHaveAttribute(
        'data-active'
      );
    });

    it('renders vote buttons with level 1 selected', () => {
      const handleVote = vi.fn();

      render(
        <NumericVoteButtons
          selection={1}
          counts={{ level1: 10, level2: 7, level3: 2 }}
          onVote={handleVote}
        />
      );

      const button1 = screen.getByRole('button', { name: '投票1' });
      const button2 = screen.getByRole('button', { name: '投票2' });
      const button3 = screen.getByRole('button', { name: '投票3' });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
      expect(button3).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onVote with correct level when buttons are clicked', () => {
      const handleVote = vi.fn();

      render(
        <NumericVoteButtons
          selection={null}
          counts={{ level1: 1, level2: 1, level3: 1 }}
          onVote={handleVote}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '投票1' }));
      expect(handleVote).toHaveBeenCalledWith(1);

      fireEvent.click(screen.getByRole('button', { name: '投票2' }));
      expect(handleVote).toHaveBeenCalledWith(2);

      fireEvent.click(screen.getByRole('button', { name: '投票3' }));
      expect(handleVote).toHaveBeenCalledWith(3);
    });
  });

  describe('Hook mode', () => {
    it('uses hook data when answerId is provided', () => {
      mockUseNumericVoteButtons.mockReturnValue({
        selection: 2,
        counts: { level1: 8, level2: 12, level3: 4 },
        handleVote: vi.fn(),
        isVoting: false,
      });

      render(
        <NumericVoteButtons
          answerId={123}
          initialVotes={{ level1: 5, level2: 10, level3: 2 }}
        />
      );

      expect(screen.getByRole('button', { name: '投票1' })).toHaveTextContent(
        '1'
      );
      expect(screen.getByRole('button', { name: '投票2' })).toHaveTextContent(
        '2'
      );
      expect(screen.getByRole('button', { name: '投票3' })).toHaveTextContent(
        '3'
      );

      const button2 = screen.getByRole('button', { name: '投票2' });
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      expect(mockUseNumericVoteButtons).toHaveBeenCalledWith({
        answerId: 123,
        initialVotes: { level1: 5, level2: 10, level3: 2 },
        votesBy: undefined,
        actionPath: undefined,
        loginRedirectPath: undefined,
        onSelectionChange: undefined,
      });
    });

    it('passes additional props to hook', () => {
      const onSelectionChange = vi.fn();

      mockUseNumericVoteButtons.mockReturnValue({
        selection: null,
        counts: { level1: 3, level2: 6, level3: 9 },
        handleVote: vi.fn(),
        isVoting: false,
      });

      render(
        <NumericVoteButtons
          answerId={456}
          initialVotes={{ level1: 1, level2: 2, level3: 3 }}
          votesBy={{ '1': 1, '2': 2 }}
          actionPath="/api/vote"
          loginRedirectPath="/login"
          onSelectionChange={onSelectionChange}
        />
      );

      expect(mockUseNumericVoteButtons).toHaveBeenCalledWith({
        answerId: 456,
        initialVotes: { level1: 1, level2: 2, level3: 3 },
        votesBy: { '1': 1, '2': 2 },
        actionPath: '/api/vote',
        loginRedirectPath: '/login',
        onSelectionChange,
      });
    });

    it('calls handleVote from hook when buttons are clicked', () => {
      const handleVote = vi.fn();

      mockUseNumericVoteButtons.mockReturnValue({
        selection: null,
        counts: { level1: 1, level2: 1, level3: 1 },
        handleVote,
        isVoting: false,
      });

      render(
        <NumericVoteButtons
          answerId={789}
          initialVotes={{ level1: 0, level2: 0, level3: 0 }}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '投票1' }));
      expect(handleVote).toHaveBeenCalledWith(1);

      fireEvent.click(screen.getByRole('button', { name: '投票3' }));
      expect(handleVote).toHaveBeenCalledWith(3);
    });
  });
});
