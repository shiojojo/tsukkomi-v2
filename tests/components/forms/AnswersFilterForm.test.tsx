import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnswersFilterForm } from '~/components/forms/AnswersFilterForm';

// Mock child components
vi.mock('~/components/ui/SearchInput', () => ({
  SearchInput: (props: any) => (
    <input
      data-testid="search-input"
      value={props.value}
      onChange={e => props.onChange(e.target.value)}
    />
  ),
}));

vi.mock('./DateRangeFilter', () => ({
  DateRangeFilter: (props: any) => (
    <div data-testid="date-range-filter">
      DateRangeFilter: {props.fromDate} - {props.toDate}
    </div>
  ),
}));

vi.mock('~/components/ui/Button', () => ({
  Button: (props: any) => (
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
  const mockUseNumericInput = vi.mocked(
    require('~/hooks/common/useNumericInput').useNumericInput
  );

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
    mockUseNumericInput.mockReturnValue({
      increment: vi.fn(),
      decrement: vi.fn(),
    });
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

    const options = screen.getAllByRole('option', { hidden: true });
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
    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
    expect(screen.getByText('最小スコア')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByText('has comments')).toBeInTheDocument();
  });

  it('hides advanced filters when showAdvancedFilters is false', () => {
    render(<AnswersFilterForm {...baseProps} showAdvancedFilters={false} />);

    expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('date-range-filter')).not.toBeInTheDocument();
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

    const dateRangeFilter = screen.getByTestId('date-range-filter');
    expect(dateRangeFilter).toHaveTextContent(
      'DateRangeFilter: 2024-01-01 - 2024-01-31'
    );
  });

  it('shows "回答" instead of "全員" when mode is favorites', () => {
    render(<AnswersFilterForm {...baseProps} mode="favorites" />);

    expect(screen.getByDisplayValue('回答')).toBeInTheDocument();
  });
});
