import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchInput } from '~/components/ui/SearchInput';

describe('SearchInput', () => {
  it('renders with default props', () => {
    render(<SearchInput />);
    const input = screen.getByRole('searchbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('name', 'q');
    expect(input).toHaveAttribute('placeholder', 'お題タイトルで検索');
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('aria-label', 'お題タイトルで検索');
  });

  it('renders with custom props', () => {
    render(
      <SearchInput
        name="custom-name"
        placeholder="Custom placeholder"
        className="custom-class"
      />
    );
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('name', 'custom-name');
    expect(input).toHaveAttribute('placeholder', 'Custom placeholder');
    expect(input).toHaveClass(
      'form-input',
      'w-full',
      'text-sm',
      'custom-class'
    );
  });

  it('renders as controlled component with value', () => {
    render(<SearchInput value="test value" />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('test value');
  });

  it('renders as uncontrolled component with defaultValue', () => {
    render(<SearchInput defaultValue="default value" />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('default value');
  });

  it('calls onChange when input value changes', () => {
    const handleChange = vi.fn();
    render(<SearchInput onChange={handleChange} />);
    const input = screen.getByRole('searchbox');

    fireEvent.change(input, { target: { value: 'new value' } });
    expect(handleChange).toHaveBeenCalledWith('new value');
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('does not call onChange when onChange is not provided', () => {
    render(<SearchInput />);
    const input = screen.getByRole('searchbox');

    // This should not throw an error
    expect(() => {
      fireEvent.change(input, { target: { value: 'new value' } });
    }).not.toThrow();
  });

  it('has correct aria-label', () => {
    render(<SearchInput placeholder="Search topics" />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-label', 'Search topics');
  });
});
