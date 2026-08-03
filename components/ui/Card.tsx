import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export type CardVariant = 'default' | 'hover' | 'selected' | 'danger' | 'success';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'border-gray-200 bg-white',
  hover: 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md cursor-pointer',
  selected: 'border-primary-500 bg-primary-50/40 ring-1 ring-primary-500',
  danger: 'border-danger-200 bg-danger-50/40',
  success: 'border-success-200 bg-success-50/40',
};

export function Card({ variant = 'default', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border shadow-sm transition-all duration-150 ease-out',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 px-5 py-4 border-b border-gray-100', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold text-gray-900', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-gray-500', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-3 px-5 py-4 border-t border-gray-100', className)} {...props} />
  );
}
