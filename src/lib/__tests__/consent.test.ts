import { describe, it, expect } from 'vitest';
import {
  CONSENT_METHOD_OPTIONS,
  CONSENT_STATUS_PRESENTATION,
  canWithdraw,
  consentMethodLabel,
  consentStatusPresentation,
  formatConsentTimestamp,
} from '@/lib/consent';
import type { ConsentMethod, ConsentStatus } from '@/types';

/**
 * The backend's CONSENT_METHODS list (microcrop-backend src/config/consent.js), which
 * its Joi validator rejects anything outside of. A method the dashboard offers but the
 * server refuses is a control that 400s in a farmer's face.
 */
const BACKEND_METHODS: ConsentMethod[] = [
  'IN_PERSON_VERBAL_ATTESTED',
  'IN_PERSON_SIGNATURE',
  'SMS_REPLY',
  'USSD',
  'WEB_FORM',
  'PAPER_RECORD_IMPORT',
];

const BACKEND_STATUSES: ConsentStatus[] = ['NOT_GIVEN', 'GRANTED', 'REVOKED', 'SUPERSEDED'];

describe('consent capture methods', () => {
  it('offers exactly the methods the backend enum accepts', () => {
    expect(CONSENT_METHOD_OPTIONS.map((o) => o.value).sort()).toEqual([...BACKEND_METHODS].sort());
  });

  it('gives every method a human label rather than the raw SCREAMING_SNAKE token', () => {
    for (const option of CONSENT_METHOD_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
      // USSD is legitimately its own name; what must never surface is the enum's
      // underscore form in front of a field agent.
      expect(option.label).not.toContain('_');
    }
  });

  it('falls back to the raw value for a method it does not know', () => {
    expect(consentMethodLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});

describe('consent status presentation', () => {
  it('covers every status the backend can derive', () => {
    for (const status of BACKEND_STATUSES) {
      expect(CONSENT_STATUS_PRESENTATION[status]).toBeDefined();
    }
  });

  /**
   * THE POINT OF THIS MODULE. "Never asked" and "asked, agreed, then withdrew" are
   * different facts about a person. If they share a label, a colour or an explanation,
   * an operator will re-ask a farmer who already exercised their right to withdraw.
   */
  it('keeps REVOKED visually and verbally distinct from NOT_GIVEN', () => {
    const revoked = CONSENT_STATUS_PRESENTATION.REVOKED;
    const notGiven = CONSENT_STATUS_PRESENTATION.NOT_GIVEN;

    expect(revoked.label).not.toBe(notGiven.label);
    expect(revoked.variant).not.toBe(notGiven.variant);
    expect(revoked.explanation).not.toBe(notGiven.explanation);
    expect(revoked.explanation).toMatch(/withdrew|withdrawn/i);
    expect(notGiven.explanation).toMatch(/never been asked/i);
  });

  it('gives all four statuses distinct labels', () => {
    const labels = BACKEND_STATUSES.map((s) => CONSENT_STATUS_PRESENTATION[s].label);
    expect(new Set(labels).size).toBe(BACKEND_STATUSES.length);
  });

  it('distinguishes SUPERSEDED as consent against an older version, not an absence', () => {
    expect(CONSENT_STATUS_PRESENTATION.SUPERSEDED.explanation).toMatch(/older version/i);
    expect(CONSENT_STATUS_PRESENTATION.SUPERSEDED.variant).not.toBe(
      CONSENT_STATUS_PRESENTATION.NOT_GIVEN.variant,
    );
  });

  it('degrades safely on an unrecognised status rather than throwing', () => {
    const unknown = consentStatusPresentation('SOMETHING_ELSE');
    expect(unknown.label).toBe('SOMETHING_ELSE');
    expect(unknown.variant).toBe('default');
  });
});

describe('canWithdraw', () => {
  // The backend 404s a withdrawal with no grant behind it — it refuses to write a
  // revocation that would fabricate a record of consent never given.
  it('is true only where a standing grant exists', () => {
    expect(canWithdraw('GRANTED')).toBe(true);
    expect(canWithdraw('SUPERSEDED')).toBe(true);
    expect(canWithdraw('NOT_GIVEN')).toBe(false);
    expect(canWithdraw('REVOKED')).toBe(false);
  });
});

describe('formatConsentTimestamp', () => {
  it('returns null for missing values instead of "Invalid Date"', () => {
    expect(formatConsentTimestamp(null)).toBeNull();
    expect(formatConsentTimestamp(undefined)).toBeNull();
    expect(formatConsentTimestamp('not-a-date')).toBeNull();
  });

  it('formats a real timestamp', () => {
    expect(formatConsentTimestamp('2026-02-01T10:30:00Z')).toEqual(expect.any(String));
  });
});
