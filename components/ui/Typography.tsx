import { createElement, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type HeadingLevel = 1 | 2 | 3 | 4;

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  as?: ElementType;
  children: ReactNode;
}

const headingStyles: Record<HeadingLevel, string> = {
  1: 'text-3xl sm:text-4xl font-bold tracking-tight text-gray-900',
  2: 'text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900',
  3: 'text-xl font-semibold text-gray-900',
  4: 'text-lg font-semibold text-gray-900',
};

export function Heading({ level = 1, as, className, children, ...props }: HeadingProps) {
  const tag = as ?? (`h${level}` as ElementType);
  return createElement(tag, { className: cn(headingStyles[level], className), ...props }, children);
}

export type TextSize = 'body' | 'small' | 'caption';

export interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  size?: TextSize;
  as?: ElementType;
  muted?: boolean;
  mono?: boolean;
  children: ReactNode;
}

const textSizeStyles: Record<TextSize, string> = {
  body: 'text-sm leading-relaxed',
  small: 'text-[13px] leading-normal',
  caption: 'text-xs leading-normal',
};

export function Text({ size = 'body', as = 'p', muted = false, mono = false, className, children, ...props }: TextProps) {
  return createElement(
    as,
    {
      className: cn(
        textSizeStyles[size],
        muted ? 'text-gray-500' : 'text-gray-700',
        mono && 'font-mono tabular-nums',
        className
      ),
      ...props,
    },
    children
  );
}
