import { forwardRef } from 'react';

export type ButtonVariant =
  | 'control'
  | 'small'
  | 'secondary'
  | 'smallSecondary'
  | 'tertiary'
  | 'loadMore'
  | 'destructive'
  | 'icon';

export type ButtonProps = {
  variant?: ButtonVariant;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const buttonStyles = {
  control: {
    base: 'inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-md text-sm font-medium border',
    active: 'bg-blue-600 text-white border-blue-600',
    inactive:
      'bg-white text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100',
  },
  small: {
    base: 'inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-medium border shadow-sm',
    active: 'bg-blue-600 text-white border-blue-600',
    inactive:
      'bg-transparent text-gray-800 border-gray-200 dark:bg-transparent dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700',
  },
  secondary: {
    base: 'inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50',
  },
  smallSecondary: {
    base: 'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-blue-200 bg-black text-white hover:bg-gray-800',
  },
  tertiary: {
    base: 'text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700',
  },
  loadMore: {
    base: 'px-4 py-2 rounded-md border bg-white disabled:opacity-50 mb-4',
  },
  destructive: {
    base: 'text-sm text-red-600 hover:text-red-800',
  },
  icon: {
    base: 'p-2 rounded-md hover:opacity-90',
    active: 'text-red-500',
    inactive: 'text-gray-400 dark:text-white',
  },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'control', active, children, className, ...props }, ref) => {
    const styles = buttonStyles[variant];
    let stateClass = '';
    if ('active' in styles && 'inactive' in styles && active !== undefined) {
      stateClass = active ? styles.active : styles.inactive;
    }

    return (
      <button
        ref={ref}
        className={`${styles.base} ${stateClass} ${className || ''}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
