import { useId, useState } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BUSY_REASON } from './step-access';

export interface OnboardingStepperStep<Id extends string = string> {
  id: Id;
  title: string;
  icon: LucideIcon;
}

interface OnboardingStepperProps<Id extends string> {
  steps: readonly OnboardingStepperStep<Id>[];
  currentIndex: number;
  /** Whether a step's record really exists. A done step (other than the current one) is ticked. */
  isComplete: (id: Id) => boolean;
  /**
   * A request is in flight. Every other step waits with BUSY_REASON until it settles, because
   * the request's success handler moves the wizard on its own.
   */
  busy?: boolean;
  onSelect: (index: number) => void;
  className?: string;
  listClassName?: string;
}

/**
 * The progress strip shared by the crop and livestock onboarding wizards. Every step is a
 * button and every step opens, in any order: what a step still needs is checked when its
 * action is submitted, not when it is opened (see step-access).
 *
 * The one exception is a request in flight. Then the other steps say why they wait, three
 * ways: the title tooltip (pointer), aria-describedby (screen readers), and a visible status
 * line under the strip once one is clicked or tapped — the only one a field agent on a phone
 * sees, since touch screens show no tooltips and the step labels are hidden below `lg`.
 *
 * `aria-disabled` is used instead of `disabled` so a waiting step stays focusable and its
 * reason can be read. The "Step N of M" line is a live region, so a screen-reader user who
 * opens a step hears which screen they are now on.
 */
export function OnboardingStepper<Id extends string>({
  steps, currentIndex, isComplete, busy = false, onSelect, className, listClassName,
}: OnboardingStepperProps<Id>) {
  const baseId = useId();
  // The step the agent tried while a request was in flight, and the step they were on. The
  // notice disappears when the request settles, and belongs to the step the agent was on.
  const [tried, setTried] = useState<{ index: number; from: number } | null>(null);

  const triedStep = busy && tried && tried.from === currentIndex ? steps[tried.index] : undefined;

  return (
    <nav aria-label="Onboarding progress" className={cn('mb-8', className)}>
      <p className="mb-3 text-sm text-muted-foreground" role="status" aria-live="polite">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.title}
      </p>
      <ol className={cn('flex items-center', listClassName)}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCurrent = index === currentIndex;
          const waiting = busy && !isCurrent;
          // Completion ignores `busy`: a request in flight does not undo the steps before it.
          const isCompleted = !isCurrent && isComplete(step.id);
          const reasonId = `${baseId}-${step.id}-waiting`;

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
                  waiting ? 'cursor-wait' : !isCurrent && 'cursor-pointer',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={waiting || undefined}
                aria-describedby={waiting ? reasonId : undefined}
                aria-label={isCompleted ? `${step.title} (completed)` : step.title}
                title={waiting ? BUSY_REASON : undefined}
                onClick={() => {
                  if (isCurrent) return;
                  if (waiting) {
                    setTried({ index, from: currentIndex });
                    return;
                  }
                  setTried(null);
                  onSelect(index);
                }}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-background text-primary animate-pulse ring-4 ring-primary/20',
                    !isCompleted && !isCurrent && 'border-muted-foreground/25 bg-background text-muted-foreground/50',
                    !isCurrent && !waiting && 'group-hover:ring-4 group-hover:ring-primary/20',
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
              {waiting && <span id={reasonId} className="sr-only">{BUSY_REASON}</span>}
            </li>
          );
        })}
      </ol>
      <p
        className={cn('text-sm text-amber-700 dark:text-amber-300', triedStep && 'mt-3')}
        role="status"
        aria-live="polite"
        data-testid="stepper-locked-notice"
      >
        {triedStep ? `Can't open ${triedStep.title} yet. ${BUSY_REASON}.` : null}
      </p>
    </nav>
  );
}
