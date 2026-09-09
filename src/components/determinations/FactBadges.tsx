/**
 * ONE BADGE PER FACT, and they are separate components on purpose.
 *
 * A single `<StatusBadge variant={getStatusVariant(status)}>` over all three would be shorter and
 * would be the bug: `getStatusVariant` maps on a lowercased status string, so
 * `NOT_SETTLED_BY_MICROCROP` and `SETTLEMENT_FAILED` both fall through to the same default, and
 * `REPORTED` would pick up nothing at all. Keeping them apart also makes it impossible to render
 * one combined badge for a determination, which is the failure the whole three-facts shape
 * exists to prevent.
 */
import { StatusBadge } from '@/components/ui/status-badge';
import {
  partnerReportStatusMeta,
  settlementStatusMeta,
  PARTNER_ATTESTED_SHORT,
} from '@/lib/determinations';
import type { PartnerReportStatus, SettlementFactStatus } from '@/types';

/** FACT 1 — did the parametric trigger fire? The determination's actual answer. */
export function TriggeredBadge({ triggered }: { triggered: boolean }) {
  return triggered ? (
    <StatusBadge
      variant="warning"
      title="The measured loss reached this policy's trigger, so an amount is owed on it."
    >
      Trigger fired
    </StatusBadge>
  ) : (
    <StatusBadge
      variant="default"
      title="The measured loss did not reach this policy's trigger, so nothing is owed on it. The determination is complete."
    >
      No trigger
    </StatusBadge>
  );
}

/** FACT 2 — did MicroCrop settle? Under Tier 1 a deliberate no, styled neutrally. */
export function SettlementFactBadge({ status }: { status: SettlementFactStatus | string }) {
  const meta = settlementStatusMeta(status);
  return (
    <StatusBadge variant={meta.variant} title={meta.help}>
      {meta.label}
    </StatusBadge>
  );
}

/**
 * FACT 3 — what the partner says. Never green: a success colour here would read as MicroCrop
 * confirming the farmer was paid, and MicroCrop has confirmed nothing. The unverified sentence
 * rides in the `title` so the disclaimer travels with the badge into a table cell.
 */
export function PartnerReportBadge({ status }: { status: PartnerReportStatus | string }) {
  const meta = partnerReportStatusMeta(status);
  const title =
    status === 'REPORTED' ? `${meta.help} ${PARTNER_ATTESTED_SHORT}` : meta.help;
  return (
    <StatusBadge variant={meta.variant} title={title}>
      {meta.label}
    </StatusBadge>
  );
}

/**
 * The standing label that must accompany any partner-attested value. Deliberately plain text
 * rather than a coloured badge — it is a qualifier on a fact, not a status of its own.
 */
export function UnverifiedLabel({ className }: { className?: string }) {
  return (
    <span
      className={className}
      title={PARTNER_ATTESTED_SHORT}
    >
      Partner-attested · unverified
    </span>
  );
}
