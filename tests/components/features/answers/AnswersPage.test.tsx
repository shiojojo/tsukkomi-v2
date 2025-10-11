import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnswersPage } from '~/components/features/answers/AnswersPage';

// Mock the hooks
vi.mock('~/hooks/useAnswersPage', () => ({
  useAnswersPage: vi.fn(() => ({
    topicsById: {},
    commentsByAnswer: {},
    users: [],
    answers: [],
    total: 0,
    getNameByProfileId: vi.fn(() => 'Test User'),
    currentUserId: 'test-user-id',
    currentUserName: 'Test User',
    userAnswerData: {},
    markFavorite: vi.fn(),
    profileId: undefined,
    filters: {
      q: '',
      author: '',
      sortBy: 'newest',
      minScore: '',
      hasComments: false,
      fromDate: '',
      toDate: '',
    },
    updateFilter: vi.fn(),
    showAdvancedFilters: false,
    toggleAdvancedFilters: vi.fn(),
    currentPage: 1,
    pageCount: 1,
    buildHref: vi.fn(() => '/test'),
  })),
}));

// Mock components
vi.mock('~/components/forms/FilterForm', () => ({
  FilterForm: () => <div data-testid="filter-form">FilterForm</div>,
}));

vi.mock('~/components/features/answers/AnswersList', () => ({
  AnswersList: () => <div data-testid="answers-list">AnswersList</div>,
}));

vi.mock('~/components/layout/ListPageLayout', () => ({
  ListPageLayout: ({
    filters,
    list,
  }: {
    filters: React.ReactNode;
    list: React.ReactNode;
  }) => (
    <div data-testid="list-page-layout">
      {filters}
      {list}
    </div>
  ),
}));

vi.mock('~/components/layout/StickyHeaderLayout', () => ({
  default: ({
    header,
    children,
  }: {
    header: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="sticky-header-layout">
      {header}
      {children}
    </div>
  ),
}));

vi.mock('~/components/features/topics/TopicOverviewCard', () => ({
  TopicOverviewCard: () => (
    <div data-testid="topic-overview-card">TopicOverviewCard</div>
  ),
}));

describe('AnswersPage', () => {
  const mockData = {
    answers: [],
    total: 0,
    page: 1,
    pageSize: 20,
    q: '',
    author: '',
    sortBy: 'newest',
    minScore: 0,
    hasComments: false,
    fromDate: '',
    toDate: '',
    topicsById: {},
    commentsByAnswer: {},
    users: [],
    profileId: undefined,
  };

  it('renders correctly in all mode', () => {
    render(<AnswersPage data={mockData} mode="all" />);

    expect(screen.getByTestId('filter-form')).toBeInTheDocument();
    expect(screen.getByTestId('answers-list')).toBeInTheDocument();
    expect(screen.queryByTestId('topic-overview-card')).not.toBeInTheDocument();
  });

  it('renders correctly in topic mode with topic', () => {
    const mockTopic = { id: 1, title: 'Test Topic' };
    render(
      <AnswersPage data={mockData} mode="topic" topicId="1" topic={mockTopic} />
    );

    expect(screen.getByTestId('filter-form')).toBeInTheDocument();
    expect(screen.getByTestId('answers-list')).toBeInTheDocument();
    expect(screen.getByTestId('topic-overview-card')).toBeInTheDocument();
  });

  it('renders correctly in favorites mode', () => {
    render(<AnswersPage data={mockData} mode="favorites" />);

    expect(screen.getByTestId('filter-form')).toBeInTheDocument();
    expect(screen.getByTestId('answers-list')).toBeInTheDocument();
    expect(screen.queryByTestId('topic-overview-card')).not.toBeInTheDocument();
  });
});
