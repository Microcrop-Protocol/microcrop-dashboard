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
  /** Steps before this index are drawn as completed, unless they are locked. */
  furthestIndex: number;
  /** Why a step cannot be opened right now, or null when it can. */
  lockedReason: (id: Id) => string | null;
  /**
   * Which of a step's prerequisites is missing, or null. A step before `furthestIndex` is drawn
   * as completed only while this is null. Defaults to `lockedReason`; a wizard passes it apart
   * when a step can be done yet locked (the crop boundary, once the policy is bought).
   */
  prerequisiteGap?: (id: Id) => string | null;
  /**
   * A request is in flight. Every other step is locked with BUSY_REASON until it settles,
   * because the request's success handler moves the wizard on its own.
   */
  busy?: boolean;
  onSelect: (index: number) => void;
  className?: string;
  listClassName?: string;
}

/**
 * The progress strip shared by the crop and livestock onboarding wizards. Every step is a
 * button: a completed or reachable one opens that step, a locked one stays put and says why.
 *
 * The reason is given three ways: the title tooltip (pointer), aria-describedby (screen
 * readers), and a visible status line under the strip once the locked step is clicked or
 * tapped. The last one is the only one a field agent on a phone sees: touch screens show no
 * tooltips and the step labels are hidden below `lg`.
 *
 * `aria-disabled` is used instead of `disabled` so a locked step stays focusable and its reason
 * can be read. The "Step N of M" line is a live region, so a screen-reader user who opens a
 * step hears which screen they are now on.
 */
export function OnboardingStepper<Id extends string>({
  steps, currentIndex, furthestIndex, lockedReason, prerequisiteGap = lockedReason, busy = false, onSelect, className, listClassName,
}: OnboardingStepperProps<Id>) {
  const baseId = useId();
  // The locked step the agent last tried, and the step they were on when they tried it. The
  // notice reads the step's reason live, so it disappears as soon as the step opens up, and it
  // belongs to the step the agent was on: moving anywhere clears it.
  const [tried, setTried] = useState<{ index: number; from: number } | null>(null);

  const reasonFor = (id: Id) => (busy ? BUSY_REASON : lockedReason(id));

  const triedStep = tried && tried.from === currentIndex ? steps[tried.index] : undefined;
  const triedReason = triedStep ? reasonFor(triedStep.id) : null;

  return (
    <nav aria-label="Onboarding progress" className={cn('mb-8', className)}>
      <p className="mb-3 text-sm text-muted-foreground" role="status" aria-live="polite">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.title}
      </p>
      <ol className={cn('flex items-center', listClassName)}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCurrent = index === currentIndex;
          const reason = isCurrent ? null : reasonFor(step.id);
          const locked = reason != null;
          // Completion ignores `busy`: a request in flight does not undo the steps before it.
          // A step whose prerequisites are gone (a quote went stale) is not drawn as completed.
          const isCompleted = !isCurrent && index < furthestIndex && prerequisiteGap(step.id) == null;
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
                  if (isCurrent) return;
                  if (locked) {
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
      <p
        className={cn('text-sm text-amber-700 dark:text-amber-300', triedReason && 'mt-3')}
        role="status"
        aria-live="polite"
        data-testid="stepper-locked-notice"
      >
        {triedStep && triedReason ? `Can't open ${triedStep.title}. ${triedReason}.` : null}
      </p>
    </nav>
  );
}
