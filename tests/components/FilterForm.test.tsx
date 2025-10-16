import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterForm } from '~/components/forms/FilterForm';
import type { User } from '~/lib/schemas/user';

// Mock react-router
vi.mock('react-router', () => ({
  Form: ({ children, ...props }: React.FormHTMLAttributes<HTMLFormElement>) => (
    <form {...props}>{children}</form>
  ),
}));

// Mock the components
vi.mock('~/components/ui/SearchInput', () => ({
  SearchInput: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

vi.mock('~/components/forms/DateRangeFilter', () => ({
  DateRangeFilter: ({
    fromDate,
    toDate,
    onFromDateChange,
    onToDateChange,
  }: {
    fromDate: string;
    toDate: string;
    onFromDateChange: (date: string) => void;
    onToDateChange: (date: string) => void;
  }) => (
    <div data-testid="date-range-filter">
      <input
        data-testid="from-date"
        value={fromDate}
        onChange={e => onFromDateChange(e.target.value)}
      />
      <input
        data-testid="to-date"
        value={toDate}
        onChange={e => onToDateChange(e.target.value)}
      />
    </div>
  ),
}));

describe('FilterForm', () => {
  const mockUsers: User[] = [
    { id: '1', name: 'User1', subUsers: [] },
    { id: '2', name: 'User2', subUsers: [] },
  ];

  describe('topics type', () => {
    const defaultProps = {
      type: 'topics' as const,
      query: '',
      setQuery: vi.fn(),
      fromDate: '',
      setFromDate: vi.fn(),
      toDate: '',
      setToDate: vi.fn(),
    };

    it('renders search input and date range filter', () => {
      render(<FilterForm {...defaultProps} />);

      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument();
    });

    it('calls setQuery when search input changes', () => {
      render(<FilterForm {...defaultProps} />);

      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'test query' } });

      expect(defaultProps.setQuery).toHaveBeenCalledWith('test query');
    });

    it('calls date change handlers', () => {
      render(<FilterForm {...defaultProps} />);

      const fromDateInput = screen.getByTestId('from-date');
      const toDateInput = screen.getByTestId('to-date');

      fireEvent.change(fromDateInput, { target: { value: '2023-01-01' } });
      fireEvent.change(toDateInput, { target: { value: '2023-12-31' } });

      expect(defaultProps.setFromDate).toHaveBeenCalledWith('2023-01-01');
      expect(defaultProps.setToDate).toHaveBeenCalledWith('2023-12-31');
    });
  });

  describe('answers type', () => {
    const defaultProps = {
      type: 'answers' as const,
      users: mockUsers,
      query: '',
      setQuery: vi.fn(),
      fromDate: '',
      setFromDate: vi.fn(),
      toDate: '',
      setToDate: vi.fn(),
      authorQuery: '',
      setAuthorQuery: vi.fn(),
      sortBy: 'newest' as const,
      setSortBy: vi.fn(),
      minScore: '0',
      setMinScore: vi.fn(),
      hasComments: false,
      setHasComments: vi.fn(),
      showAdvancedFilters: false,
      toggleAdvancedFilters: vi.fn(),
    };

    it('renders basic filters when advanced filters are hidden', () => {
      render(<FilterForm {...defaultProps} />);

      expect(screen.getByDisplayValue('新着')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '詳細フィルタ' })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument();
    });

    it('renders advanced filters when showAdvancedFilters is true', () => {
      render(<FilterForm {...defaultProps} showAdvancedFilters={true} />);

      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '詳細を閉じる' })
      ).toBeInTheDocument();
    });

    it('calls setAuthorQuery when author select changes', () => {
      render(<FilterForm {...defaultProps} />);

      const authorSelect = screen.getByDisplayValue('全員');
      fireEvent.change(authorSelect, { target: { value: 'User1' } });

      expect(defaultProps.setAuthorQuery).toHaveBeenCalledWith('User1');
    });

    it('calls setSortBy when sort select changes', () => {
      render(<FilterForm {...defaultProps} />);

      const sortSelect = screen.getByDisplayValue('新着');
      fireEvent.change(sortSelect, { target: { value: 'oldest' } });

      expect(defaultProps.setSortBy).toHaveBeenCalledWith('oldest');
    });

    it('calls toggleAdvancedFilters when button is clicked', () => {
      render(<FilterForm {...defaultProps} />);

      const button = screen.getByRole('button', { name: '詳細フィルタ' });
      fireEvent.click(button);

      expect(defaultProps.toggleAdvancedFilters).toHaveBeenCalled();
    });

    it('increments minScore when + button is clicked', () => {
      render(<FilterForm {...defaultProps} showAdvancedFilters={true} />);

      const incrementButton = screen.getByRole('button', { name: '+' });
      fireEvent.click(incrementButton);

      expect(defaultProps.setMinScore).toHaveBeenCalledWith('1');
    });

    it('decrements minScore when - button is clicked', () => {
      render(
        <FilterForm {...defaultProps} showAdvancedFilters={true} minScore="2" />
      );

      const decrementButton = screen.getByRole('button', { name: '-' });
      fireEvent.click(decrementButton);

      expect(defaultProps.setMinScore).toHaveBeenCalledWith('1');
    });

    it('calls setHasComments when checkbox changes', () => {
      render(<FilterForm {...defaultProps} showAdvancedFilters={true} />);

      const checkbox = screen.getByRole('checkbox', { name: 'has comments' });
      fireEvent.click(checkbox);

      expect(defaultProps.setHasComments).toHaveBeenCalledWith(true);
    });
  });
});
