import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { AnswersList } from '~/components/features/answers/AnswersList';
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
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useFetcher: () => ({
    submit: vi.fn(),
    data: null,
    state: 'idle',
  }),
}));

// Mock child components
vi.mock('./AnswerActionCard', () => ({
  default: ({ answer, topic, comments }: any) => (
    <div data-testid={`answer-action-card-${answer.id}`}>
      <div>{topic?.title || 'お題なし（フリー回答）'}</div>
      <p>{answer.text}</p>
      <div>
        Score: <span>4</span>
      </div>
      <span>作者: Test User</span>
      <div>コメント{comments.length}</div>
    </div>
  ),
}));
vi.mock('~/components/common/Pagination', () => ({
  Pagination: ({ currentPage, pageCount, buildHref: _buildHref }: any) => (
    <div data-testid="pagination">
      Pagination - Page {currentPage} of {pageCount}
    </div>
  ),
}));

describe('AnswersList', () => {
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
    image: null,
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
    answers: [mockAnswer],
    topicsById: { '1': mockTopic },
    topic: undefined as Topic | undefined,
    commentsByAnswer: { '1': mockComments },
    getNameByProfileId: vi.fn(id =>
      id === 'user1' ? 'Test User' : 'Other User'
    ),
    currentUserName: 'Test User',
    currentUserId: 'user1',
    userAnswerData: { votes: {} },
    actionPath: '/test-action',
    profileIdForVotes: 'user1' as string | null,
    pagination: null as any,
    emptyMessage: '表示される回答がありません。',
  };

  it('renders answers with AnswerActionCard components', () => {
    render(<AnswersList {...defaultProps} />, { wrapper: createTestWrapper() });

    expect(screen.getByText('Test answer text')).toBeInTheDocument();
  });

  it('passes correct topic to AnswerActionCard when using topicsById', () => {
    render(<AnswersList {...defaultProps} />, { wrapper: createTestWrapper() });

    expect(screen.getByText('Test topic title')).toBeInTheDocument();
  });

  it('passes direct topic prop to AnswerActionCard when topic is provided', () => {
    const propsWithTopic = {
      ...defaultProps,
      topic: mockTopic,
      topicsById: undefined,
    };
    render(<AnswersList {...propsWithTopic} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('Test topic title')).toBeInTheDocument();
  });

  it('passes comments to AnswerActionCard', () => {
    render(<AnswersList {...defaultProps} />, { wrapper: createTestWrapper() });

    expect(screen.getByText('コメント1')).toBeInTheDocument();
  });

  it('renders pagination when pagination prop is provided', () => {
    const paginationProps = {
      ...defaultProps,
      pagination: {
        currentPage: 2,
        pageCount: 5,
        buildHref: (page: number) => `/page/${page}`,
      },
    };
    render(<AnswersList {...paginationProps} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    expect(screen.getByText('Pagination - Page 2 of 5')).toBeInTheDocument();
  });

  it('does not render pagination when pagination prop is null', () => {
    render(<AnswersList {...defaultProps} />, { wrapper: createTestWrapper() });

    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
  });

  it('renders empty message when answers array is empty', () => {
    const emptyProps = { ...defaultProps, answers: [] };
    render(<AnswersList {...emptyProps} />, { wrapper: createTestWrapper() });

    expect(
      screen.getByText('表示される回答がありません。')
    ).toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    const customEmptyProps = {
      ...defaultProps,
      answers: [],
      emptyMessage: 'カスタム空メッセージ',
    };
    render(<AnswersList {...customEmptyProps} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('カスタム空メッセージ')).toBeInTheDocument();
  });

  it('handles multiple answers', () => {
    const mockAnswer2: Answer = {
      ...mockAnswer,
      id: 2,
      text: 'Second answer',
    };
    const multipleAnswersProps = {
      ...defaultProps,
      answers: [mockAnswer, mockAnswer2],
      commentsByAnswer: {
        '1': mockComments,
        '2': [],
      },
    };
    render(<AnswersList {...multipleAnswersProps} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('Test answer text')).toBeInTheDocument();
    expect(screen.getByText('Second answer')).toBeInTheDocument();
  });

  it('handles answers without matching topics', () => {
    const propsWithoutTopics = { ...defaultProps, topicsById: {} };
    render(<AnswersList {...propsWithoutTopics} />, {
      wrapper: createTestWrapper(),
    });

    expect(screen.getByText('お題なし（フリー回答）')).toBeInTheDocument();
  });
});
