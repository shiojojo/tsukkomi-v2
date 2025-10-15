import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopicsFilterForm } from '~/components/forms/TopicsFilterForm';

// Mock child components
vi.mock('~/components/ui/SearchInput', () => ({
  SearchInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Search..."
    />
  ),
}));

vi.mock('~/components/ui/Button', () => ({
  Button: ({ children, ...props }: any) => (
    <button data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('./DateRangeFilter', () => ({
  DateRangeFilter: ({
    fromDate,
    toDate,
    onFromDateChange,
    onToDateChange,
  }: any) => (
    <div data-testid="date-range-filter">
      DateRangeFilter: {fromDate} - {toDate}
    </div>
  ),
}));

describe('TopicsFilterForm', () => {
  const defaultProps = {
    query: 'test query',
    setQuery: vi.fn(),
    fromDate: '2024-01-01',
    setFromDate: vi.fn(),
    toDate: '2024-01-31',
    setToDate: vi.fn(),
  };

  it('renders form with correct method', () => {
    render(<TopicsFilterForm {...defaultProps} />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('method', 'get');
  });

  it('renders SearchInput with correct props', () => {
    render(<TopicsFilterForm {...defaultProps} />);

    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toHaveValue('test query');
  });

  it('calls setQuery when SearchInput changes', () => {
    render(<TopicsFilterForm {...defaultProps} />);

    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'new query' } });

    expect(defaultProps.setQuery).toHaveBeenCalledWith('new query');
  });

  it('renders DateRangeFilter with correct props', () => {
    render(<TopicsFilterForm {...defaultProps} />);

    const dateRangeFilter = screen.getByTestId('date-range-filter');
    expect(dateRangeFilter).toHaveTextContent(
      'DateRangeFilter: 2024-01-01 - 2024-01-31'
    );
  });

  it('renders submit button with correct text', () => {
    render(<TopicsFilterForm {...defaultProps} />);

    const button = screen.getByTestId('button');
    expect(button).toHaveTextContent('検索');
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('applies correct CSS classes', () => {
    render(<TopicsFilterForm {...defaultProps} />);

    const form = screen.getByRole('form');
    expect(form).toHaveClass('space-y-2');

    const container = screen
      .getByText('DateRangeFilter: 2024-01-01 - 2024-01-31')
      .closest('.flex');
    expect(container).toHaveClass('flex', 'flex-wrap', 'gap-2', 'items-center');
  });

  it('renders with empty values', () => {
    const emptyProps = {
      query: '',
      setQuery: vi.fn(),
      fromDate: '',
      setFromDate: vi.fn(),
      toDate: '',
      setToDate: vi.fn(),
    };

    render(<TopicsFilterForm {...emptyProps} />);

    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toHaveValue('');

    const dateRangeFilter = screen.getByTestId('date-range-filter');
    expect(dateRangeFilter).toHaveTextContent('DateRangeFilter:  - ');
  });
});
