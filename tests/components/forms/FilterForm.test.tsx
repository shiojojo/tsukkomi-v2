import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterForm } from '~/components/forms/FilterForm';

// Mock child components
vi.mock('./AnswersFilterForm', () => ({
  AnswersFilterForm: (props: any) => (
    <div data-testid="answers-filter-form">
      AnswersFilterForm: {props.query}
    </div>
  ),
}));

vi.mock('./TopicsFilterForm', () => ({
  TopicsFilterForm: (props: any) => (
    <div data-testid="topics-filter-form">TopicsFilterForm: {props.query}</div>
  ),
}));

describe('FilterForm', () => {
  const baseProps = {
    query: 'test query',
    setQuery: vi.fn(),
    fromDate: '2024-01-01',
    setFromDate: vi.fn(),
    toDate: '2024-01-31',
    setToDate: vi.fn(),
  };

  it('renders TopicsFilterForm when type is topics', () => {
    const topicsProps = {
      ...baseProps,
      type: 'topics' as const,
    };

    render(<FilterForm {...topicsProps} />);

    expect(screen.getByTestId('topics-filter-form')).toBeInTheDocument();
    expect(screen.queryByTestId('answers-filter-form')).not.toBeInTheDocument();
    expect(
      screen.getByText('TopicsFilterForm: test query')
    ).toBeInTheDocument();
  });

  it('renders AnswersFilterForm when type is answers', () => {
    const answersProps = {
      ...baseProps,
      type: 'answers' as const,
      users: [],
      authorQuery: '',
      setAuthorQuery: vi.fn(),
      sortBy: 'newest' as const,
      setSortBy: vi.fn(),
      minScore: '',
      setMinScore: vi.fn(),
      hasComments: false,
      setHasComments: vi.fn(),
      showAdvancedFilters: false,
      toggleAdvancedFilters: vi.fn(),
    };

    render(<FilterForm {...answersProps} />);

    expect(screen.getByTestId('answers-filter-form')).toBeInTheDocument();
    expect(screen.queryByTestId('topics-filter-form')).not.toBeInTheDocument();
    expect(
      screen.getByText('AnswersFilterForm: test query')
    ).toBeInTheDocument();
  });

  it('passes correct props to TopicsFilterForm', () => {
    const topicsProps = {
      ...baseProps,
      type: 'topics' as const,
    };

    render(<FilterForm {...topicsProps} />);

    const topicsForm = screen.getByTestId('topics-filter-form');
    expect(topicsForm).toHaveTextContent('test query');
  });

  it('passes correct props to AnswersFilterForm', () => {
    const answersProps = {
      ...baseProps,
      type: 'answers' as const,
      users: [{ id: '1', name: 'Test User' }],
      authorQuery: 'author query',
      setAuthorQuery: vi.fn(),
      sortBy: 'scoreDesc' as const,
      setSortBy: vi.fn(),
      minScore: '10',
      setMinScore: vi.fn(),
      hasComments: true,
      setHasComments: vi.fn(),
      showAdvancedFilters: true,
      toggleAdvancedFilters: vi.fn(),
      onSubmit: vi.fn(),
      mode: 'all' as const,
    };

    render(<FilterForm {...answersProps} />);

    const answersForm = screen.getByTestId('answers-filter-form');
    expect(answersForm).toHaveTextContent('test query');
  });
});
