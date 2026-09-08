import { FlaskConical } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { SIMULATED_EXPLANATION, SIMULATED_LABEL } from "@/lib/simulated";
import { cn } from "@/lib/utils";

/**
 * The marker for a record the backend created in sandbox mode: no payment was taken,
 * nothing was sent to a farmer and nothing exists on-chain. See `@/lib/simulated` for how
 * such a record is recognised.
 *
 * DESIGN CONSTRAINTS (all deliberate, please keep them):
 *  - It must be readable at a glance in a LIST, not just on a detail page, because a UAT
 *    mixes test and real rows in the same table.
 *  - It must not be mistakable for a STATUS. Hence a hue no status badge uses, a dashed
 *    border, an icon, and wording that names no workflow state.
 *  - The wording must be plain. "TEST DATA — NO REAL MONEY" is understandable to a partner
 *    who has never heard of SIMULATE_PAYMENTS; `title` carries the full sentence.
 */
export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <StatusBadge variant="simulated" className={cn("gap-1", className)} title={SIMULATED_EXPLANATION}>
      <FlaskConical className="h-3 w-3 shrink-0" aria-hidden="true" />
      {SIMULATED_LABEL}
    </StatusBadge>
  );
}

/**
 * The detail-page / above-the-table form of the same warning. Used where there is room to
 * say the whole thing, and where a reader is about to act on the record (or read a total
 * that includes it).
 */
export function SimulatedBanner({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-dashed border-chart-4/60 bg-chart-4/10 p-4 text-sm",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-chart-4" aria-hidden="true" />
      <div>
        <p className="font-semibold uppercase tracking-wide text-chart-4">{SIMULATED_LABEL}</p>
        <p className="mt-1 text-muted-foreground">{children ?? SIMULATED_EXPLANATION}</p>
      </div>
    </div>
  );
}
