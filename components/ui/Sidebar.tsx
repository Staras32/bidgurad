'use client';

import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SidebarProps extends HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
}

/** Desktop sidebar shell. Pass `collapsed` to switch to icon-only rail width. */
export function Sidebar({ collapsed = false, className, children, ...props }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-gray-200 bg-white transition-[width] duration-150 ease-out',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex h-14 items-center gap-2 border-b border-gray-100 px-4', className)} {...props} />;
}

export function SidebarNav({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <nav className={cn('flex flex-1 flex-col gap-0.5 overflow-y-auto p-2', className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-t border-gray-100 p-2', className)} {...props} />;
}

export interface SidebarItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  icon?: ReactNode;
  active?: boolean;
  collapsed?: boolean;
  children?: ReactNode;
}

export function SidebarItem({ icon, active = false, collapsed = false, className, children, ...props }: SidebarItemProps) {
  return (
    <a
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-150 ease-out',
        collapsed && 'justify-center',
        active ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {!collapsed && <span className="truncate">{children}</span>}
    </a>
  );
}

export interface MobileSidebarProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
}

/** Slide-in drawer variant for small screens; renders an overlay + panel. */
export function MobileSidebar({ open, onClose, className, children, ...props }: MobileSidebarProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="absolute inset-0 bg-gray-900/40 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          'relative flex h-full w-64 flex-col bg-white shadow-lg animate-fade-in',
          className
        )}
        {...props}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Uždaryti meniu"
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-700"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
