'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  error?: boolean;
  onChange?: (value: string) => void;
  onStep?: (direction: 1 | -1) => void;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, error = false, disabled, onChange, onStep, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          aria-invalid={error || undefined}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'h-9 w-full rounded-md border bg-white pl-3 pr-8 text-sm text-gray-900 tabular-nums placeholder:text-gray-400',
            'transition-colors duration-150 ease-out',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500',
            error
              ? 'border-danger-500 focus:ring-danger-500/30 focus:border-danger-500'
              : 'border-gray-200 hover:border-gray-300',
            disabled && 'cursor-not-allowed bg-gray-50 text-gray-400 hover:border-gray-200',
            className
          )}
          {...props}
        />
        {onStep && !disabled && (
          <div className="absolute right-1 flex flex-col">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Padidinti"
              onClick={() => onStep(1)}
              className="flex h-4 w-6 items-center justify-center text-gray-400 hover:text-gray-700"
            >
              <ChevronUp size={12} />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Sumažinti"
              onClick={() => onStep(-1)}
              className="flex h-4 w-6 items-center justify-center text-gray-400 hover:text-gray-700"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }
);
NumberInput.displayName = 'NumberInput';
