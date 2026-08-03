'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error = false, leftIcon, rightIcon, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3 flex items-center text-gray-400">{leftIcon}</span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          aria-invalid={error || undefined}
          className={cn(
            'h-9 w-full rounded-md border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400',
            'transition-colors duration-150 ease-out',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500',
            error
              ? 'border-danger-500 focus:ring-danger-500/30 focus:border-danger-500'
              : 'border-gray-200 hover:border-gray-300',
            disabled && 'cursor-not-allowed bg-gray-50 text-gray-400 hover:border-gray-200',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            className
          )}
          {...props}
        />
        {rightIcon && <span className="absolute right-3 flex items-center text-gray-400">{rightIcon}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
