'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error = false, disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        aria-invalid={error || undefined}
        className={cn(
          'w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400',
          'transition-colors duration-150 ease-out resize-y',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500',
          error
            ? 'border-danger-500 focus:ring-danger-500/30 focus:border-danger-500'
            : 'border-gray-200 hover:border-gray-300',
          disabled && 'cursor-not-allowed bg-gray-50 text-gray-400 hover:border-gray-200',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
