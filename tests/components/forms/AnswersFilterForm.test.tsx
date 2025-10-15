import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnswersFilterForm } from '~/components/forms/AnswersFilterForm';

// Mock react-router Form component
vi.mock('react-router', () => ({
  Form: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <form role="form" {...props}>
      {children}
    </form>
  ),
  useSubmit: vi.fn(() => vi.fn()),
}));

// Mock child components
vi.mock('~/components/ui/SearchInput', () => ({
  SearchInput: (props: {
    value?: string;
    onChange?: (value: string) => void;
    [key: string]: unknown;
  }) => (
    <input
      data-testid="search-input"
      value={props.value}
      onChange={
        props.onChange ? e => props.onChange!(e.target.value) : undefined
      }
    />
  ),
}));

vi.mock('~/components/ui/Button', () => ({
  Button: (props: {
    variant?: string;
    type?: 'button' | 'submit' | 'reset';
    onClick?: () => void;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <button
      data-testid={`button-${props.variant || 'default'}`}
      type={props.type}
      onClick={props.onClick}
      {...props}
    >
      {props.children}
    </button>
  ),
}));

// Mock the useNumericInput hook
vi.mock('~/hooks/common/useNumericInput', () => ({
  useNumericInput: vi.fn(() => ({
    increment: vi.fn(),
    decrement: vi.fn(),
  })),
}));

describe('AnswersFilterForm', () => {
  const baseProps = {
    query: 'test query',
    setQuery: vi.fn(),
    fromDate: '2024-01-01',
    setFromDate: vi.fn(),
    toDate: '2024-01-31',
    setToDate: vi.fn(),
    users: [
      { id: '1', name: 'User 1' },
      { id: '2', name: 'User 2' },
    ],
    authorQuery: '',
    setAuthorQuery: vi.fn(),
    sortBy: 'newest' as const,
    setSortBy: vi.fn(),
    minScore: '10',
    setMinScore: vi.fn(),
    hasComments: false,
    setHasComments: vi.fn(),
    showAdvancedFilters: false,
    toggleAdvancedFilters: vi.fn(),
    onSubmit: vi.fn(),
    mode: 'all' as const,
  };

  beforeEach(() => {
    // Reset mocks if needed
  });

  it('renders form with correct method', () => {
    render(<AnswersFilterForm {...baseProps} />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('method', 'get');
  });

  it('renders author select with correct options', () => {
    render(<AnswersFilterForm {...baseProps} />);

    const authorSelect = screen.getByDisplayValue('全員');
    expect(authorSelect).toBeInTheDocument();

    const options = authorSelect.querySelectorAll('option');
    expect(options).toHaveLength(3); // "全員" + 2 users
    expect(options[1]).toHaveTextContent('User 1');
    expect(options[2]).toHaveTextContent('User 2');
  });

  it('renders sortBy select with correct options', () => {
    render(<AnswersFilterForm {...baseProps} />);

    const sortSelect = screen.getByDisplayValue('新着');
    expect(sortSelect).toBeInTheDocument();

    const options = screen.getAllByRole('option', { hidden: true });
    expect(options.some(option => option.textContent === '新着')).toBe(true);
    expect(options.some(option => option.textContent === '古い順')).toBe(true);
    expect(options.some(option => option.textContent === 'スコア順')).toBe(
      true
    );
  });

  it('renders toggle advanced filters button', () => {
    render(<AnswersFilterForm {...baseProps} />);

    const button = screen.getByText('詳細フィルタ');
    expect(button).toBeInTheDocument();
  });

  it('shows advanced filters when showAdvancedFilters is true', () => {
    render(<AnswersFilterForm {...baseProps} showAdvancedFilters={true} />);

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByLabelText('開始日')).toBeInTheDocument();
    expect(screen.getByLabelText('終了日')).toBeInTheDocument();
    expect(screen.getByText('最小スコア')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByText('has comments')).toBeInTheDocument();
  });

  it('hides advanced filters when showAdvancedFilters is false', () => {
    render(<AnswersFilterForm {...baseProps} showAdvancedFilters={false} />);

    expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('開始日')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('終了日')).not.toBeInTheDocument();
    expect(screen.queryByText('最小スコア')).not.toBeInTheDocument();
  });

  it('renders minScore input and increment/decrement buttons', () => {
    render(<AnswersFilterForm {...baseProps} showAdvancedFilters={true} />);

    const minScoreInput = screen.getByDisplayValue('10');
    expect(minScoreInput).toBeInTheDocument();

    const buttons = screen.getAllByText(/[-+]/);
    expect(buttons).toHaveLength(2);
  });

  it('renders hasComments checkbox', () => {
    render(<AnswersFilterForm {...baseProps} showAdvancedFilters={true} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('renders search button', () => {
    render(<AnswersFilterForm {...baseProps} />);

    const searchButton = screen.getByText('検索');
    expect(searchButton).toBeInTheDocument();
    expect(searchButton).toHaveAttribute('type', 'submit');
  });

  it('calls toggleAdvancedFilters when button is clicked', () => {
    render(<AnswersFilterForm {...baseProps} />);

    const button = screen.getByText('詳細フィルタ');
    fireEvent.click(button);

    expect(baseProps.toggleAdvancedFilters).toHaveBeenCalledTimes(1);
  });

  it('calls setAuthorQuery when author select changes', () => {
    render(<AnswersFilterForm {...baseProps} />);

    const authorSelect = screen.getByDisplayValue('全員');
    fireEvent.change(authorSelect, { target: { value: 'User 1' } });

    expect(baseProps.setAuthorQuery).toHaveBeenCalledWith('User 1');
  });

  it('calls setSortBy when sortBy select changes', () => {
    render(<AnswersFilterForm {...baseProps} />);

    const sortSelect = screen.getByDisplayValue('新着');
    fireEvent.change(sortSelect, { target: { value: 'scoreDesc' } });

    expect(baseProps.setSortBy).toHaveBeenCalledWith('scoreDesc');
  });

  it('calls setHasComments when checkbox changes', () => {
    render(<AnswersFilterForm {...baseProps} showAdvancedFilters={true} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(baseProps.setHasComments).toHaveBeenCalledWith(true);
  });

  it('passes correct props to DateRangeFilter', () => {
    render(<AnswersFilterForm {...baseProps} showAdvancedFilters={true} />);

    const fromDateInput = screen.getByLabelText('開始日');
    const toDateInput = screen.getByLabelText('終了日');

    expect(fromDateInput).toHaveValue('2024-01-01');
    expect(toDateInput).toHaveValue('2024-01-31');
  });

  it('shows "回答" instead of "全員" when mode is favorites', () => {
    render(<AnswersFilterForm {...baseProps} mode="favorites" />);

    expect(screen.getByDisplayValue('回答')).toBeInTheDocument();
  });
});
