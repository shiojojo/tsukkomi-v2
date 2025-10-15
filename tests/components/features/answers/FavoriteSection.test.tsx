import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FavoriteSection } from '~/components/features/answers/FavoriteSection';
import type { Answer } from '~/lib/schemas/answer';

// Mock child component
vi.mock('~/components/common/FavoriteButton', () => ({
  default: ({ answerId, initialFavorited, initialCount }: any) => (
    <div data-testid="favorite-button">
      FavoriteButton - answerId: {answerId}, favorited:{' '}
      {String(initialFavorited)}, count: {initialCount}
    </div>
  ),
}));

describe('FavoriteSection', () => {
  it('renders FavoriteButton with correct props', () => {
    const mockAnswer = {
      id: 1,
      text: 'Test answer',
      profileId: 'user1',
      topicId: 1,
      votes: { level1: 0, level2: 0, level3: 0 },
      votesBy: {},
      created_at: '2024-01-01T00:00:00Z',
      favCount: 5,
    } as Answer;

    render(<FavoriteSection answer={mockAnswer} />);

    expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    expect(
      screen.getByText(
        'FavoriteButton - answerId: 1, favorited: false, count: 5'
      )
    ).toBeInTheDocument();
  });

  it('passes initialFavorited as false', () => {
    const mockAnswer: Answer = {
      id: 2,
      text: 'Another answer',
      profileId: 'user2',
      topicId: 2,
      votes: { level1: 0, level2: 0, level3: 0 },
      votesBy: {},
      created_at: '2024-01-01T00:00:00Z',
    };

    render(<FavoriteSection answer={mockAnswer} />);

    expect(
      screen.getByText(
        'FavoriteButton - answerId: 2, favorited: false, count: 0'
      )
    ).toBeInTheDocument();
  });

  it('handles undefined favCount', () => {
    const mockAnswer: Answer = {
      id: 3,
      text: 'Answer without favCount',
      profileId: 'user3',
      topicId: 3,
      votes: { level1: 0, level2: 0, level3: 0 },
      votesBy: {},
      created_at: '2024-01-01T00:00:00Z',
      // favCount is not defined
    };

    render(<FavoriteSection answer={mockAnswer} />);

    expect(
      screen.getByText(
        'FavoriteButton - answerId: 3, favorited: false, count: 0'
      )
    ).toBeInTheDocument();
  });
});
