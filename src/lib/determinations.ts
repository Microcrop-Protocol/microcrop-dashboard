/**
 * PRESENTATION RULES FOR THE THREE FACTS.
 *
 * A determination carries three separate statements and the whole product depends on a reader
 * never confusing them:
 *
 *   determined     what MICROCROP determined — signed, hashed, anchored, re-verifiable.
 *   settlement     whether MICROCROP settled. Under Tier 1 the answer is a deliberate NO.
 *   partnerReport  what the PARTNER claims it did. Partner-attested, NEVER verified by us.
 *
 * Everything in this module exists to stop those three collapsing into one badge. Hence three
 * separate label maps rather than one `getStatusVariant`-style lookup: a single map keyed on a
 * bare status string is exactly how `NOT_SETTLED_BY_MICROCROP` ends up rendered in the same red
 * as `SETTLEMENT_FAILED`, which would tell a Tier 1 partner its product is broken.
 *
 * COLOUR IS SEMANTIC HERE, NOT DECORATIVE:
 *   - a deliberate non-settlement is NEUTRAL (`info`/`default`), never `error`. It is the
 *     correct outcome of the plan the partner bought.
 *   - `NO_PAYOUT_DUE` is likewise neutral: the trigger did not fire, which is a valid,
 *     complete, signed determination — not a failure to pay.
 *   - a partner-attested report is never `success`. `success` on FACT 3 would read as MicroCrop
 *     confirming the farmer was paid, and MicroCrop has confirmed nothing.
 */
import { formatMoneyMinor } from '@/lib/money-minor';
import type { StatusBadgeProps } from '@/components/ui/status-badge';
import type {
  MoneyMinor,
  DeterminationStatus,
  PartnerReportStatus,
  PartnerSettlementMethod,
  PartnerSettlementOutcome,
  SettlementFactStatus,
} from '@/types';

interface Meta {
  label: string;
  variant: StatusBadgeProps['variant'];
  help: string;
}

// ---------------------------------------------------------------------------
// FACT 2 — did MicroCrop settle?
// ---------------------------------------------------------------------------

export const SETTLEMENT_STATUS_META: Record<SettlementFactStatus, Meta> = {
  // Tier 1 — both of these are CORRECT OUTCOMES and are styled as such.
  NOT_SETTLED_BY_MICROCROP: {
    label: 'Not settled by MicroCrop',
    // Neutral, never error: under the Determination plan this is what was bought.
    variant: 'info',
    help:
      'By design. MicroCrop issued the signed determination and deliberately did not originate ' +
      'or settle any payment — settling the farmer is your obligation under this policy.',
  },
  NO_PAYOUT_DUE: {
    label: 'No payout due',
    variant: 'default',
    help:
      'The determination completed and the measured loss did not reach the policy trigger, so ' +
      'nothing is owed on this policy. This is a finished determination, not a failure.',
  },
  // Tier 2 — MicroCrop's own settlement lifecycle.
  SETTLEMENT_PENDING: {
    label: 'Settlement pending',
    variant: 'pending',
    help: 'MicroCrop has the determination and has not yet submitted the settlement.',
  },
  SETTLEMENT_IN_PROGRESS: {
    label: 'Settling',
    variant: 'processing',
    help: 'MicroCrop is submitting the settlement transaction now.',
  },
  SETTLEMENT_SUBMITTED_ON_CHAIN: {
    label: 'Settled on-chain',
    variant: 'completed',
    help: 'MicroCrop submitted and confirmed the settlement on-chain.',
  },
  SETTLEMENT_BLOCKED_UNDERFUNDED: {
    label: 'Blocked — underfunded',
    variant: 'error',
    help:
      'The reserve backing this policy was insufficient to fund the payout. It is queued and ' +
      'settles automatically once the reserve is topped up.',
  },
  SETTLEMENT_FAILED: {
    label: 'Settlement failed',
    variant: 'failed',
    help: 'The settlement submission failed. See the failure reason; MicroCrop retries it.',
  },
};

export function settlementStatusMeta(status: SettlementFactStatus | string): Meta {
  return (
    SETTLEMENT_STATUS_META[status as SettlementFactStatus] ?? {
      label: String(status),
      variant: 'default' as const,
      help: '',
    }
  );
}

// ---------------------------------------------------------------------------
// FACT 3 — what the partner says it did.
// ---------------------------------------------------------------------------

export const PARTNER_REPORT_STATUS_META: Record<PartnerReportStatus, Meta> = {
  NOT_REPORTED: {
    label: 'Awaiting your report',
    // Warning, not error: nothing has gone wrong, an action is simply outstanding.
    variant: 'pending',
    help:
      'MicroCrop has no settlement report for this determination yet. Record what you paid the ' +
      'farmer so it appears in your audit trail.',
  },
  OVERDUE: {
    label: 'Report overdue',
    variant: 'warning',
    help:
      'The reporting window for this determination has closed with no settlement report. This ' +
      'is a REPORTING state only — it does not mean MicroCrop owes anything.',
  },
  REPORTED: {
    label: 'Reported by you — unverified',
    // Deliberately NOT `success`/`completed`. A green tick here would read as MicroCrop
    // confirming the farmer was paid, and MicroCrop has confirmed nothing at all.
    variant: 'info',
    help:
      'Your organization has attested that it settled this farmer off-platform. MicroCrop did ' +
      'not observe the payment and has not verified this report.',
  },
  NOT_APPLICABLE: {
    label: 'Settled by MicroCrop',
    variant: 'default',
    help:
      'MicroCrop settled this determination itself, so there is no partner-attested settlement ' +
      'to report. The Payout record is the authoritative settlement fact.',
  },
};

export function partnerReportStatusMeta(status: PartnerReportStatus | string): Meta {
  return (
    PARTNER_REPORT_STATUS_META[status as PartnerReportStatus] ?? {
      label: String(status),
      variant: 'default' as const,
      help: '',
    }
  );
}

export const PARTNER_OUTCOME_LABELS: Record<PartnerSettlementOutcome, string> = {
  SETTLED_FULL: 'Settled in full',
  SETTLED_PARTIAL: 'Settled in part',
  DECLINED: 'Declined',
};

export const PARTNER_METHOD_LABELS: Record<PartnerSettlementMethod, string> = {
  MOBILE_MONEY: 'Mobile money',
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash',
  ACCOUNT_CREDIT: 'Account credit',
  IN_KIND: 'In kind',
  OTHER: 'Other',
};

export const PARTNER_OUTCOMES = Object.keys(PARTNER_OUTCOME_LABELS) as PartnerSettlementOutcome[];
export const PARTNER_METHODS = Object.keys(PARTNER_METHOD_LABELS) as PartnerSettlementMethod[];

/**
 * The single sentence that must accompany EVERY rendering of FACT 3.
 *
 * The API returns its own `note`, which is the authoritative wording and should be rendered
 * verbatim wherever there is room. This is the short form, for a badge title or a table cell
 * where the full sentence will not fit — never a paraphrase that softens it.
 */
export const PARTNER_ATTESTED_SHORT =
  'Partner-attested and NOT verified by MicroCrop.';

// ---------------------------------------------------------------------------
// The raw determination lifecycle (FACT 1's processing state).
// ---------------------------------------------------------------------------

/**
 * `DETERMINATION_ONLY` is a SUCCESS: MicroCrop determined, signed and anchored the result and
 * then deliberately submitted nothing on-chain, because the policy was sold under Tier 1. The
 * backend leaves `failureReason` NULL on it for exactly this reason. Rendering it red — which
 * an unknown status falling through to a default would do on a map keyed to failures — tells a
 * Tier 1 partner its only product is broken.
 */
export const DETERMINATION_ONLY: DeterminationStatus = 'DETERMINATION_ONLY';

/** Statuses a partner may filter the determinations list on. Mirrors the Prisma enum. */
export const DETERMINATION_STATUSES: DeterminationStatus[] = [
  'RECEIVED',
  'SUBMITTING',
  'CONFIRMED',
  'FAILED',
  'UNDERFUNDED',
  'DETERMINATION_ONLY',
];

/** Human label for `Determination.kind`, which is a free string column that will widen. */
export function determinationKindLabel(kind: string | null | undefined): string {
  if (!kind) return 'Determination';
  const known: Record<string, string> = {
    CROP_DAMAGE: 'Crop damage',
    LIVESTOCK_FORAGE: 'Forage failure',
    LIVESTOCK_PAYOUT: 'Livestock payout',
  };
  // An unknown kind is shown as-is, tidied — never dropped, or the row loses its subject.
  return known[kind] ?? kind.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

/**
 * The owed amount as a display string, for the determinations list column.
 *
 * Lives here rather than beside the card component so that file exports only components —
 * mixing a plain function in breaks React Fast Refresh for the whole module.
 *
 * Returns an em dash when the amount is absent. That case is real: the API deliberately
 * serves `amountOwed: null` with a reason when the figure cannot be derived, and rendering
 * a zero there would be a specific and wrong claim about what the partner owes a farmer.
 */
export function formatOwed(settlement: { amountOwed?: MoneyMinor | null }): string {
  const owed = settlement.amountOwed;
  if (!owed) return '—';
  return formatMoneyMinor(owed.amountMinor, owed.currency, owed.exponent);
}
