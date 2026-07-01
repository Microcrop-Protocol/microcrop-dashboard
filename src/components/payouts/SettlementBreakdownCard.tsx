import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeterminationStatusBadge } from "@/components/payouts/DeterminationStatusBadge";
import type { DeterminationStatus } from "@/types";

// Display order: terminal-good first, the actionable UNDERFUNDED/FAILED last.
const STATUS_ORDER: DeterminationStatus[] = [
  "CONFIRMED",
  "SUBMITTING",
  "RECEIVED",
  "UNDERFUNDED",
  "FAILED",
];

interface SettlementBreakdownCardProps {
  breakdown?: Record<string, number>;
}

/**
 * Settlement determinations grouped by status, sourced from the payout analytics
 * `byDeterminationStatus`. Highlights UNDERFUNDED — a payout owed but the backing
 * org's reserve couldn't cover it (queued until the reserve is topped up).
 */
export function SettlementBreakdownCard({ breakdown }: SettlementBreakdownCardProps) {
  const entries = STATUS_ORDER
    .map((status) => [status, breakdown?.[status] ?? 0] as const)
    .filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const underfunded = breakdown?.UNDERFUNDED ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Settlement Status</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No settlements in this period.</p>
        ) : (
          <div className="space-y-3">
            {underfunded > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {underfunded} payout{underfunded === 1 ? "" : "s"} underfunded — an org reserve
                can&apos;t cover an owed claim. Each settles automatically once the reserve is topped up.
              </div>
            )}
            <ul className="divide-y">
              {entries.map(([status, count]) => (
                <li key={status} className="flex items-center justify-between py-2">
                  <DeterminationStatusBadge status={status} />
                  <span className="text-sm font-medium tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
