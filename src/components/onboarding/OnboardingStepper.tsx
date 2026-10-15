import { useId } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OnboardingStepperStep<Id extends string = string> {
  id: Id;
  title: string;
  icon: LucideIcon;
}

interface OnboardingStepperProps<Id extends string> {
  steps: readonly OnboardingStepperStep<Id>[];
  currentIndex: number;
  /** Steps before this index are drawn as completed. */
  furthestIndex: number;
  /** Why a step cannot be opened right now, or null when it can. */
  lockedReason: (id: Id) => string | null;
  onSelect: (index: number) => void;
  className?: string;
  listClassName?: string;
}

/**
 * The progress strip shared by the crop and livestock onboarding wizards. Every step is a
 * button: a completed or reachable one opens that step, a locked one stays put and says why —
 * in its title tooltip and, for screen readers, through aria-describedby. `aria-disabled` is
 * used instead of `disabled` so a locked step stays focusable and its reason can be read.
 */
export function OnboardingStepper<Id extends string>({
  steps, currentIndex, furthestIndex, lockedReason, onSelect, className, listClassName,
}: OnboardingStepperProps<Id>) {
  const baseId = useId();

  return (
    <nav aria-label="Onboarding progress" className={cn('mb-8', className)}>
      <ol className={cn('flex items-center', listClassName)}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCurrent = index === currentIndex;
          const isCompleted = !isCurrent && index < furthestIndex;
          const reason = isCurrent ? null : lockedReason(step.id);
          const locked = reason != null;
          const reasonId = `${baseId}-${step.id}-locked`;

          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center',
                index < steps.length - 1 && 'flex-1',
                index < steps.length - 1 && 'after:mx-2 after:h-0.5 after:flex-1 after:bg-border',
                isCompleted && 'after:bg-primary',
              )}
            >
              <button
                type="button"
                className={cn(
                  'group flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  locked ? 'cursor-not-allowed' : !isCurrent && 'cursor-pointer',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={locked || undefined}
                aria-describedby={locked ? reasonId : undefined}
                aria-label={isCompleted ? `${step.title} (completed)` : step.title}
                title={reason ?? undefined}
                onClick={() => {
                  if (isCurrent || locked) return;
                  onSelect(index);
                }}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-background text-primary animate-pulse ring-4 ring-primary/20',
                    !isCompleted && !isCurrent && 'border-muted-foreground/25 bg-background text-muted-foreground/50',
                    !isCurrent && !locked && 'group-hover:ring-4 group-hover:ring-primary/20',
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span
                  className={cn(
                    'ml-2 hidden text-sm font-medium lg:inline',
                    isCurrent && 'text-foreground',
                    isCompleted && 'text-primary',
                    !isCompleted && !isCurrent && 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </span>
              </button>
              {locked && <span id={reasonId} className="sr-only">{reason}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
