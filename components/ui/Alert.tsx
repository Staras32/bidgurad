import type { HTMLAttributes, ReactNode } from 'react';
import { Info, AlertTriangle, XCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type AlertVariant = 'info' | 'warning' | 'error' | 'success';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onClose?: () => void;
  children?: ReactNode;
}

const variantConfig: Record<AlertVariant, { icon: typeof Info; className: string; iconClassName: string }> = {
  info: { icon: Info, className: 'bg-primary-50 border-primary-200 text-primary-800', iconClassName: 'text-primary-500' },
  warning: {
    icon: AlertTriangle,
    className: 'bg-warning-50 border-warning-200 text-warning-800',
    iconClassName: 'text-warning-500',
  },
  error: { icon: XCircle, className: 'bg-danger-50 border-danger-200 text-danger-800', iconClassName: 'text-danger-500' },
  success: {
    icon: CheckCircle2,
    className: 'bg-success-50 border-success-200 text-success-800',
    iconClassName: 'text-success-500',
  },
};

export function Alert({ variant = 'info', title, onClose, className, children, ...props }: AlertProps) {
  const { icon: Icon, className: variantClassName, iconClassName } = variantConfig[variant];
  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', variantClassName, className)}
      {...props}
    >
      <Icon size={18} className={cn('mt-0.5 shrink-0', iconClassName)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn('text-[13px]', title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Uždaryti"
          className="shrink-0 opacity-60 hover:opacity-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
