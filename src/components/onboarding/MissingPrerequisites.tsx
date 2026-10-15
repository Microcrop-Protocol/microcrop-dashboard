import { AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MissingPrerequisite } from './step-access';

interface MissingPrerequisitesProps<Id extends string> {
  /** What the agent is trying to do, completing "Before you can …", e.g. "get a quote". */
  action: string;
  missing: readonly MissingPrerequisite<Id>[];
  /** The step's own form has fields that fail validation (they are highlighted inline). */
  fieldsIncomplete?: boolean;
  stepTitle: (id: Id) => string;
  onGoTo: (id: Id) => void;
  /**
   * `blocked`: a submit was just refused, announced as an alert. `notice`: shown on arrival at
   * a step that has nothing meaningful to show without earlier data.
   */
  variant?: 'blocked' | 'notice';
  className?: string;
}

/**
 * Everything still missing before a step's action can go through, in one place, each earlier
 * gap a button to the step that fills it. Rendered instead of making a request the backend
 * would refuse, or that would attach to a record that does not exist yet.
 */
export function MissingPrerequisites<Id extends string>({
  action, missing, fieldsIncomplete = false, stepTitle, onGoTo, variant = 'blocked', className,
}: MissingPrerequisitesProps<Id>) {
  if (!missing.length && !fieldsIncomplete) return null;
  return (
    <div
      role={variant === 'blocked' ? 'alert' : undefined}
      data-testid={variant === 'blocked' ? 'submit-blocked' : 'step-missing-notice'}
      className={cn(
        'rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200',
        className,
      )}
    >
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-2">
          <p className="font-medium">Before you can {action}:</p>
          <ul className="space-y-1">
            {fieldsIncomplete && <li>Complete the highlighted fields on this step</li>}
            {missing.map((item) => (
              <li key={item.step + item.label}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-left underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  onClick={() => onGoTo(item.step)}
                >
                  {item.label} ({stepTitle(item.step)})
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
