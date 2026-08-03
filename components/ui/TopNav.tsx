import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TopNavProps extends HTMLAttributes<HTMLElement> {
  left?: ReactNode;
  right?: ReactNode;
}

export function TopNav({ left, right, className, children, ...props }: TopNavProps) {
  return (
    <header
      className={cn('flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6', className)}
      {...props}
    >
      {left && <div className="flex shrink-0 items-center gap-3">{left}</div>}
      <nav className="flex flex-1 items-center gap-1 overflow-x-auto">{children}</nav>
      {right && <div className="flex shrink-0 items-center gap-3">{right}</div>}
    </header>
  );
}

export interface TopNavItemProps extends HTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function TopNavItem({ active = false, className, ...props }: TopNavItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out',
        active ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
        className
      )}
      {...props}
    />
  );
}
