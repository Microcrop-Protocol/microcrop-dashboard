import { StatusBadge } from "@/components/ui/status-badge";
import type { StatusBadgeProps } from "@/components/ui/status-badge";
import type { DeterminationStatus } from "@/types";

// DeterminationStatus -> presentation. UNDERFUNDED is the critical state: the
// org reserve couldn't fully fund the payout, so it's queued until topped up.
const META: Record<
  DeterminationStatus,
  { label: string; variant: StatusBadgeProps["variant"]; help: string }
> = {
  RECEIVED: { label: "Received", variant: "pending", help: "Determination received; awaiting on-chain submission." },
  SUBMITTING: { label: "Submitting", variant: "processing", help: "On-chain settlement transaction in flight." },
  CONFIRMED: { label: "Confirmed", variant: "completed", help: "Settled on-chain." },
  FAILED: { label: "Failed", variant: "failed", help: "On-chain submission failed; it will be retried." },
  UNDERFUNDED: {
    label: "Underfunded",
    variant: "error",
    help: "The org reserve was insufficient to fund this payout. It is queued and settles automatically once the reserve is topped up.",
  },
  // NEUTRAL, and deliberately not `error` or `failed`. This is the terminal SUCCESS state of
  // the Determination plan: we determined, we signed, and we did not settle because settling is
  // the partner's obligation under the plan it bought. Rendering it in the same red as FAILED or
  // UNDERFUNDED would tell a Tier 1 partner its product is broken on every determination it ever
  // receives. See lib/determinations.ts — the three facts must never collapse into one badge.
  DETERMINATION_ONLY: {
    label: "Determination only",
    variant: "info",
    help: "MicroCrop determined the outcome and did not settle. Under the Determination plan, paying the farmer is your organization's obligation, settled off-platform.",
  },
};

interface DeterminationStatusBadgeProps {
  status: DeterminationStatus;
  className?: string;
}

export function DeterminationStatusBadge({ status, className }: DeterminationStatusBadgeProps) {
  const meta = META[status] ?? { label: status, variant: "default" as const, help: "" };
  return (
    <StatusBadge variant={meta.variant} className={className} title={meta.help}>
      {meta.label}
    </StatusBadge>
  );
}
