import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  sticky?: boolean;
}

export function TableHeader({ className, sticky = false, ...props }: TableHeaderProps) {
  return (
    <thead
      className={cn(
        'bg-gray-50',
        sticky && 'sticky top-0 z-10',
        className
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-gray-100', className)} {...props} />;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  hover?: boolean;
}

export function TableRow({ className, hover = true, ...props }: TableRowProps) {
  return (
    <tr
      className={cn(hover && 'transition-colors duration-150 ease-out hover:bg-gray-50', className)}
      {...props}
    />
  );
}

export function TableHeadCell({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-gray-200 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export type SortDirection = 'asc' | 'desc' | null;

export interface TableSortableHeadCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  direction: SortDirection;
  onSort: () => void;
}

export function TableSortableHeadCell({
  className,
  children,
  direction,
  onSort,
  ...props
}: TableSortableHeadCellProps) {
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown;
  return (
    <th
      className={cn(
        'border-b border-gray-200 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500',
        className
      )}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'inline-flex items-center gap-1 hover:text-gray-700',
          direction && 'text-gray-900'
        )}
      >
        {children}
        <Icon size={12} />
      </button>
    </th>
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 text-gray-700', className)} {...props} />;
}
