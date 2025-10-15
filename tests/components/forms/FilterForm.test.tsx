import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FilterForm } from '~/components/forms/FilterForm';

// Mock react-router Form component
vi.mock('react-router', () => ({
  Form: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <form {...props}>{children}</form>,
  useSubmit: vi.fn(() => vi.fn()),
}));

// Mock child components
vi.mock('./AnswersFilterForm', () => ({
  AnswersFilterForm: (props: { query: string; [key: string]: unknown }) => (
    <div data-testid="answers-filter-form">
      AnswersFilterForm: {props.query}
    </div>
  ),
}));

vi.mock('./TopicsFilterForm', () => ({
  TopicsFilterForm: (props: { query: string; [key: string]: unknown }) => (
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

  const topicsProps = {
    ...baseProps,
    type: 'topics' as const,
  };

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

  it('renders TopicsFilterForm when type is topics', () => {
    render(<FilterForm {...topicsProps} />);

    expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
    expect(screen.getByLabelText('開始日')).toBeInTheDocument();
    expect(screen.getByLabelText('終了日')).toBeInTheDocument();
  });

  it('renders AnswersFilterForm when type is answers', () => {
    render(<FilterForm {...answersProps} />);

    expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});
