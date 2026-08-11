import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface StepperStep {
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  clickableSteps?: number[];
  onStepClick?: (step: number) => void;
  className?: string;
}

/** Horizontal numbered-step progress indicator for multi-step flows (wizards, onboarding). */
export function Stepper({ steps, currentStep, clickableSteps = [], onStepClick, className }: StepperProps) {
  const lastIndex = steps.length - 1;
  const progress = lastIndex > 0 ? ((currentStep - 1) / lastIndex) * 100 : 0;

  return (
    <ol aria-label="Progress" className={cn('relative flex items-start justify-between', className)}>
      <div className="absolute left-3.5 right-3.5 top-3.5 h-px bg-gray-200" />
      <div
        className="absolute left-3.5 top-3.5 h-px bg-primary-600 transition-all duration-300 ease-out"
        style={{ width: `calc((100% - 28px) * ${progress / 100})` }}
      />
      {steps.map((step, i) => {
        const index = i + 1;
        const state = index < currentStep ? 'complete' : index === currentStep ? 'current' : 'upcoming';
        const clickable = clickableSteps.includes(index) && Boolean(onStepClick);
        const content = (
          <>
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-150 ease-out',
                state === 'complete' && 'border-primary-600 bg-primary-600 text-white',
                state === 'current' && 'border-primary-600 bg-white text-primary-600 ring-4 ring-primary-100',
                state === 'upcoming' && 'border-gray-200 bg-white text-gray-400',
                clickable && 'group-hover:border-primary-700 group-hover:text-primary-700'
              )}
            >
              {state === 'complete' ? <Check size={14} /> : index}
              <span className="sr-only">
                {state === 'complete' ? 'Completed: ' : state === 'current' ? 'Current step: ' : 'Upcoming: '}
                {step.label}
              </span>
            </div>
            <span
              className={cn(
                'hidden whitespace-nowrap text-xs font-medium sm:block',
                state === 'upcoming' ? 'text-gray-400' : 'text-gray-900',
                clickable && 'group-hover:text-primary-700 group-hover:underline'
              )}
              aria-hidden="true"
            >
              {step.label}
            </span>
          </>
        );
        return (
          <li
            key={step.label}
            aria-current={state === 'current' ? 'step' : undefined}
            className="relative z-10"
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                aria-label={`Atidaryti ${step.label}`}
                className="group flex flex-col items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-4"
              >
                {content}
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
