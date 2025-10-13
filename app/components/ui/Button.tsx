import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '~/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
        linkNoHover: 'text-primary',
        // 既存のvariantを追加
        control:
          'inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-md text-sm font-medium border bg-primary text-primary-foreground border-primary hover:bg-primary/90',
        small:
          'inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-medium border shadow-sm bg-transparent text-gray-800 border-gray-200 dark:bg-transparent dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700',
        smallSecondary:
          'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-blue-200 bg-black text-white hover:bg-gray-800',
        tertiary: 'text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700',
        loadMore:
          'px-4 py-2 rounded-md border bg-white disabled:opacity-50 mb-4',
        icon: 'p-2 rounded-md hover:opacity-90',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
      active: {
        true: 'ring-2 ring-primary/50 bg-transparent',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      active: false,
    },
  }
);

function Button({
  className,
  variant,
  size,
  active,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    active?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, active, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
