import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';

/**
 * Said on an onboarding step revisited after its record was saved: the step shows what was
 * saved and offers no submit, because submitting again would create a second record.
 */
export function SavedRecordNote({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="flex gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
