import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DateRangeFilter } from '~/components/forms/DateRangeFilter';

describe('DateRangeFilter', () => {
  it('renders with default empty values', () => {
    render(<DateRangeFilter />);

    expect(screen.getByLabelText('開始日')).toBeInTheDocument();
    expect(screen.getByLabelText('終了日')).toBeInTheDocument();

    // Check that both inputs have empty values
    const fromDateInput = screen.getByLabelText('開始日') as HTMLInputElement;
    const toDateInput = screen.getByLabelText('終了日') as HTMLInputElement;
    expect(fromDateInput.value).toBe('');
    expect(toDateInput.value).toBe('');
  });

  it('displays provided fromDate and toDate values', () => {
    render(<DateRangeFilter fromDate="2024-01-01" toDate="2024-01-31" />);

    expect(screen.getByDisplayValue('2024-01-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024-01-31')).toBeInTheDocument();
  });

  it('calls onFromDateChange when fromDate input changes', () => {
    const mockOnFromDateChange = vi.fn();
    render(<DateRangeFilter onFromDateChange={mockOnFromDateChange} />);

    const fromDateInput = screen.getByLabelText('開始日');
    fireEvent.change(fromDateInput, { target: { value: '2024-01-15' } });

    expect(mockOnFromDateChange).toHaveBeenCalledWith('2024-01-15');
  });

  it('calls onToDateChange when toDate input changes', () => {
    const mockOnToDateChange = vi.fn();
    render(<DateRangeFilter onToDateChange={mockOnToDateChange} />);

    const toDateInput = screen.getByLabelText('終了日');
    fireEvent.change(toDateInput, { target: { value: '2024-01-20' } });

    expect(mockOnToDateChange).toHaveBeenCalledWith('2024-01-20');
  });

  it('applies custom className', () => {
    render(<DateRangeFilter className="custom-class" />);

    const container = screen.getByLabelText('開始日').closest('.custom-class');
    expect(container).toBeInTheDocument();
  });

  it('does not call callbacks when not provided', () => {
    render(<DateRangeFilter />);

    const fromDateInput = screen.getByLabelText('開始日');
    const toDateInput = screen.getByLabelText('終了日');

    // These should not throw errors
    fireEvent.change(fromDateInput, { target: { value: '2024-01-15' } });
    fireEvent.change(toDateInput, { target: { value: '2024-01-20' } });
  });

  it('renders with proper input attributes', () => {
    render(<DateRangeFilter />);

    const fromDateInput = screen.getByLabelText('開始日');
    const toDateInput = screen.getByLabelText('終了日');

    expect(fromDateInput).toHaveAttribute('type', 'date');
    expect(fromDateInput).toHaveAttribute('name', 'fromDate');
    expect(toDateInput).toHaveAttribute('type', 'date');
    expect(toDateInput).toHaveAttribute('name', 'toDate');
  });
});
