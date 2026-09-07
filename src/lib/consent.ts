/**
 * Presentation helpers for farmer consent (Kenya Data Protection Act 2019).
 *
 * ############################################################################
 * # NOTHING IN THIS FILE IS CONSENT WORDING, AND NOTHING MAY BECOME IT.      #
 * # The only text a farmer may be shown is `ConsentDocument.body` as the API #
 * # returns it. Every document in the backend registry is a placeholder with #
 * # `body: null`, `approved: false` and an `UNAPPROVED-PLACEHOLDER` version, #
 * # so today there is nothing to show and the UI must say exactly that. The  #
 * # strings below describe the STATE OF THE RECORD and the CAPTURE METHOD —  #
 * # operator-facing labels — never what the farmer is agreeing to.           #
 * ############################################################################
 */
import type { ConsentMethod, ConsentStatus } from '@/types';
import type { StatusBadgeProps } from '@/components/ui/status-badge';

/**
 * How the consent was captured. Mirrors the backend `CONSENT_METHODS` /
 * Prisma `ConsentMethod` enum exactly — the backend validator rejects anything else.
 */
export const CONSENT_METHOD_OPTIONS: { value: ConsentMethod; label: string }[] = [
  { value: 'IN_PERSON_VERBAL_ATTESTED', label: 'In person — verbal, attested by the agent' },
  { value: 'IN_PERSON_SIGNATURE', label: 'In person — farmer signature' },
  { value: 'SMS_REPLY', label: 'SMS reply' },
  { value: 'USSD', label: 'USSD' },
  { value: 'WEB_FORM', label: 'Web form' },
  { value: 'PAPER_RECORD_IMPORT', label: 'Paper record import (backfill)' },
];

export function consentMethodLabel(method: ConsentMethod | string): string {
  return CONSENT_METHOD_OPTIONS.find((m) => m.value === method)?.label ?? String(method);
}

/**
 * The four derived states, each with its own badge treatment and its own plain
 * explanation of what actually happened.
 *
 * REVOKED MUST NEVER READ AS NOT_GIVEN. "Never asked" and "asked, agreed, then
 * exercised the right to withdraw" are different facts about a person, and an
 * operator who mistakes the second for the first will re-ask a farmer who already
 * said no. They therefore get different colours, different labels and different
 * explanatory text — no shared "no consent" bucket anywhere in the UI.
 */
export const CONSENT_STATUS_PRESENTATION: Record<
  ConsentStatus,
  { label: string; variant: StatusBadgeProps['variant']; explanation: string }
> = {
  GRANTED: {
    label: 'GRANTED',
    variant: 'success',
    explanation: 'Consent is on record against the document version currently in force.',
  },
  NOT_GIVEN: {
    label: 'NOT GIVEN',
    variant: 'default',
    explanation: 'This farmer has never been asked for this consent. Nothing is on record.',
  },
  REVOKED: {
    label: 'REVOKED',
    variant: 'error',
    explanation:
      'The farmer gave this consent and then withdrew it. This is not the same as never ' +
      'having been asked — the withdrawal is part of the record and stands until the ' +
      'farmer consents again.',
  },
  SUPERSEDED: {
    label: 'SUPERSEDED',
    variant: 'warning',
    explanation:
      'Consent was given against an older version of this document. The version now in ' +
      'force has not been consented to, so a fresh capture is needed.',
  },
};

export function consentStatusPresentation(status: ConsentStatus | string) {
  return (
    CONSENT_STATUS_PRESENTATION[status as ConsentStatus] ?? {
      label: String(status),
      variant: 'default' as StatusBadgeProps['variant'],
      explanation: 'Unrecognised consent state returned by the API.',
    }
  );
}

/**
 * Whether there is a standing grant that could be withdrawn. The backend 404s a
 * withdrawal with no grant behind it (it refuses to fabricate a revocation), so the
 * control is only offered where it would succeed.
 */
export function canWithdraw(status: ConsentStatus | string): boolean {
  return status === 'GRANTED' || status === 'SUPERSEDED';
}

/** Format an ISO timestamp for display; returns null rather than "Invalid Date". */
export function formatConsentTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}
