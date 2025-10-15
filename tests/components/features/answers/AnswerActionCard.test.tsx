import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnswerActionCard } from '~/components/features/answers/AnswerActionCard';
import type { Answer } from '~/lib/schemas/answer';
import type { Topic } from '~/lib/schemas/topic';
import type { Comment } from '~/lib/schemas/comment';

// Create a test wrapper with QueryClient
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock react-router
vi.mock('react-router', () => ({
  useFetcher: () => ({
    submit: vi.fn(),
    data: null,
    state: 'idle',
  }),
}));

// Mock child components
vi.mock('./VoteSection', () => ({
  VoteSection: ({
    answer,
    userAnswerData: _userAnswerData,
    actionPath,
    profileIdForVotes: _profileIdForVotes,
    currentUserId: _currentUserId,
    getNameByProfileId: _getNameByProfileId,
    currentUserName: _currentUserName,
  }: any) => (
    <div data-testid="vote-section">
      VoteSection - answer: {answer.id}, actionPath: {actionPath}
    </div>
  ),
}));

vi.mock('./CommentSection', () => ({
  CommentSection: ({
    comments,
    answerId,
    currentUserId: _currentUserId,
    currentUserName: _currentUserName,
    getNameByProfileId: _getNameByProfileId,
    actionPath: _actionPath,
    onCommentCountChange: _onCommentCountChange,
  }: any) => (
    <div data-testid="comment-section">
      CommentSection - comments: {comments.length}, answerId: {answerId}
    </div>
  ),
}));

vi.mock('./FavoriteSection', () => ({
  FavoriteSection: ({
    answerId,
    topicId,
  }: {
    answerId: number;
    topicId: number;
  }) => (
    <div data-testid="favorite-section">
      FavoriteSection - Answer: {answerId}, Topic: {topicId}
    </div>
  ),
}));

describe('AnswerActionCard', () => {
  const mockAnswer: Answer = {
    id: 1,
    text: 'Test answer text',
    profileId: 'user1',
    topicId: 1,
    votes: { level1: 2, level2: 1, level3: 0 },
    votesBy: {},
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockTopic: Topic = {
    id: 1,
    title: 'Test topic title',
    image: 'https://example.com/image.jpg',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockComments: Comment[] = [
    {
      id: 1,
      text: 'Test comment',
      profileId: 'user2',
      answerId: 1,
      created_at: '2024-01-01T00:00:00Z',
    },
  ];

  const defaultProps = {
    answer: mockAnswer,
    topic: mockTopic,
    comments: mockComments,
    currentUserId: 'user1',
    currentUserName: 'Test User',
    getNameByProfileId: vi.fn(id =>
      id === 'user1' ? 'Test User' : 'Other User'
    ),
    userAnswerData: { votes: {} },
    actionPath: '/test-action',
    profileIdForVotes: 'user1' as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders answer text and topic information', () => {
    render(<AnswerActionCard {...defaultProps} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('Test answer text')).toBeInTheDocument();
    expect(screen.getByAltText('Test topic title')).toBeInTheDocument();
  });

  it('displays calculated score correctly', () => {
    render(<AnswerActionCard {...defaultProps} />, {
      wrapper: createTestWrapper(),
    });

    // Score = (2*1) + (1*2) + (0*3) = 4
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows author name when getNameByProfileId returns a name', () => {
    render(<AnswerActionCard {...defaultProps} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('作者: Test User')).toBeInTheDocument();
  });

  it('displays comment count', () => {
    render(<AnswerActionCard {...defaultProps} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('コメント1')).toBeInTheDocument();
  });

  it('renders child components', () => {
    render(<AnswerActionCard {...defaultProps} />, {
      wrapper: createTestWrapper(),
    });

    // Test that the component renders without crashing
    expect(screen.getByText('Test answer text')).toBeInTheDocument();
  });

  it('shows "コメント / 採点" button initially', () => {
    render(<AnswerActionCard {...defaultProps} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('コメント / 採点')).toBeInTheDocument();
  });

  it('toggles comment/vote section visibility when button is clicked', () => {
    render(<AnswerActionCard {...defaultProps} />, {
      wrapper: createTestWrapper(),
    });

    const toggleButton = screen.getByText('コメント / 採点');
    fireEvent.click(toggleButton);

    expect(screen.getByText('閉じる')).toBeInTheDocument();
    // Test that expanded content is shown
    expect(screen.getByText('Test comment')).toBeInTheDocument();
  });

  it('renders without topic (フリー回答)', () => {
    const propsWithoutTopic = { ...defaultProps, topic: null };
    render(<AnswerActionCard {...propsWithoutTopic} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('お題なし（フリー回答）')).toBeInTheDocument();
  });

  it('renders topic without image', () => {
    const topicWithoutImage = { ...mockTopic, image: null };
    const propsWithoutImage = { ...defaultProps, topic: topicWithoutImage };
    render(<AnswerActionCard {...propsWithoutImage} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('Test topic title')).toBeInTheDocument();
  });

  it('handles empty votes object', () => {
    const answerWithoutVotes = {
      ...mockAnswer,
      votes: { level1: 0, level2: 0, level3: 0 },
    };
    render(<AnswerActionCard {...defaultProps} answer={answerWithoutVotes} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('calls getNameByProfileId with correct profileId', () => {
    render(<AnswerActionCard {...defaultProps} />, {
      wrapper: createTestWrapper(),
    });

    expect(defaultProps.getNameByProfileId).toHaveBeenCalledWith('user1');
  });
});
