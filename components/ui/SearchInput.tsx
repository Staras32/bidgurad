'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, disabled, ...props }, ref) => {
    const showClear = Boolean(onClear && value);
    return (
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 flex items-center text-gray-400">
          <Search size={15} />
        </span>
        <input
          ref={ref}
          type="text"
          value={value}
          disabled={disabled}
          className={cn(
            'h-9 w-full rounded-md border border-gray-200 bg-white pl-9 text-sm text-gray-900 placeholder:text-gray-400',
            'transition-colors duration-150 ease-out hover:border-gray-300',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500',
            disabled && 'cursor-not-allowed bg-gray-50 text-gray-400 hover:border-gray-200',
            showClear ? 'pr-8' : 'pr-3',
            className
          )}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Išvalyti paiešką"
            className="absolute right-2.5 flex items-center text-gray-400 hover:text-gray-700"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';
