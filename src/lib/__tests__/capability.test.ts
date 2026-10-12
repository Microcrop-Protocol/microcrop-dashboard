/**
 * THE CAPABILITY PREDICATE — fail-closed, three-valued, and spelled the same way as the server's.
 *
 * What this file pins, in the order the risks matter:
 *
 *   1. THE CONDITION IS WRITTEN IN THE POSITIVE. `enabled === true`, never `!== false`. A
 *      missing entry, null, undefined, the string 'true', 1 and a capability this build does not
 *      recognise all land on deny — identical to `isCapabilityEnabled` server-side, where
 *      ABSENCE OF A GRANT ROW IS A DENY. If the dashboard ever answered `true` where the server
 *      answers `false`, the partner would be offered a control that comes back 403, which is the
 *      precise failure the whole module exists to remove.
 *
 *   2. THE THREE STATES ARE THREE, not two. 'loading' must never resolve to either answer, and
 *      'unknown' (we could not read the map) must never share copy with 'unavailable' (we read it
 *      and you do not have this). One is a retry; the other is a plan boundary.
 *
 *   3. THE COPY READS AS A PLAN BOUNDARY. Not an error, not an outage, and never a dead end — it
 *      must name a next step, and that step is contacting MicroCrop, because a capability is not
 *      self-serve.
 *
 *   4. THE ENUM CONTAINS NO DRAIN-PATH MEMBER. A capability is mutable and org-keyed; gating
 *      settlement, a payout or a determination on one would strand cover already sold. The
 *      backend asserts this structurally and so does this file, so adding such a member to the
 *      mirror fails the build rather than quietly shipping a control that should not exist.
 */
import { describe, it, expect } from 'vitest';
import {
  CAPABILITIES,
  CAPABILITY,
  CAPABILITY_DESCRIPTIONS,
  CAPABILITY_LABELS,
  CAPABILITY_LOCKED_NEXT,
  CAPABILITY_NOT_ENABLED,
  CAPABILITY_UNKNOWN_BODY,
  CAPABILITY_UNKNOWN_TITLE,
  capabilityAllows,
  capabilityDisabledReason,
  capabilityLabel,
  capabilityLockedBody,
  capabilityLockedTitle,
  isKnownCapability,
  resolveCapabilityState,
} from '@/lib/capability';
import type { OrgCapability, OrgCapabilityStatus } from '@/types';

const complete = (overrides: Partial<Record<OrgCapability, boolean>> = {}): OrgCapabilityStatus[] =>
  CAPABILITIES.map((capability) => ({
    capability,
    label: CAPABILITY_LABELS[capability],
    enabled: overrides[capability] ?? false,
  }));

describe('resolveCapabilityState — fail-closed on everything that is not literally true', () => {
  it('is enabled only for a literal true', () => {
    const statuses = complete({ DATA_EXPORT: true });
    expect(resolveCapabilityState(CAPABILITY.DATA_EXPORT, statuses, false, false)).toBe('enabled');
  });

  it.each([
    ['false', false],
    ['null', null],
    ['undefined', undefined],
    ["the string 'true'", 'true'],
    ['the number 1', 1],
    ['an object', {}],
  ])('denies when `enabled` is %s', (_label, value) => {
    const statuses = [
      { capability: CAPABILITY.DATA_EXPORT, label: 'Data export', enabled: value },
    ] as unknown as OrgCapabilityStatus[];
    expect(resolveCapabilityState(CAPABILITY.DATA_EXPORT, statuses, false, false)).toBe(
      'unavailable',
    );
  });

  it('denies a capability missing from the response', () => {
    // The API response is COMPLETE over every capability the backend knows, so an absent entry
    // means this build and the backend disagree about the enum. The backend answered, and its
    // answer carried no grant — so 'unavailable', not 'unknown'.
    expect(resolveCapabilityState(CAPABILITY.BULK_IMPORT, [], false, false)).toBe('unavailable');
  });

  it('denies an entry for a DIFFERENT capability', () => {
    const statuses = complete({ CROP_UNDERWRITING: true });
    expect(resolveCapabilityState(CAPABILITY.BULK_IMPORT, statuses, false, false)).toBe(
      'unavailable',
    );
  });
});

describe('resolveCapabilityState — three-valued, and the two unknowns are different', () => {
  it('is loading while the map has not resolved', () => {
    expect(resolveCapabilityState(CAPABILITY.DATA_EXPORT, undefined, true, false)).toBe('loading');
  });

  it('never reports a capability as unavailable while loading', () => {
    // This is the flash: a partner that HAS the capability would be shown "not on your plan" for
    // a beat on every page load, which reads as a downgrade.
    expect(resolveCapabilityState(CAPABILITY.DATA_EXPORT, undefined, true, false)).not.toBe(
      'unavailable',
    );
  });

  it('never reports a capability as enabled while loading', () => {
    expect(resolveCapabilityState(CAPABILITY.DATA_EXPORT, undefined, true, false)).not.toBe(
      'enabled',
    );
  });

  it('is unknown once the request settles with no data', () => {
    expect(resolveCapabilityState(CAPABILITY.DATA_EXPORT, undefined, false, false)).toBe('unknown');
  });

  it('is unknown on an error, even if stale data is in hand', () => {
    // Fail closed on the action, but say honestly that we could not confirm — claiming "not on
    // your plan" would be an assertion we cannot support.
    const statuses = complete({ DATA_EXPORT: true });
    expect(resolveCapabilityState(CAPABILITY.DATA_EXPORT, statuses, false, true)).toBe('unknown');
  });

  it('does NOT return to loading on a background refetch once the map is in hand', () => {
    const statuses = complete({ DATA_EXPORT: true });
    expect(resolveCapabilityState(CAPABILITY.DATA_EXPORT, statuses, true, false)).toBe('enabled');
  });
});

describe('capabilityAllows — only a positively-known grant offers the control', () => {
  it('allows only "enabled"', () => {
    expect(capabilityAllows('enabled')).toBe(true);
    expect(capabilityAllows('loading')).toBe(false);
    expect(capabilityAllows('unknown')).toBe(false);
    expect(capabilityAllows('unavailable')).toBe(false);
  });
});

describe('isKnownCapability — never used to widen a gate', () => {
  it('recognises every mirrored capability', () => {
    for (const capability of CAPABILITIES) expect(isKnownCapability(capability)).toBe(true);
  });

  it('rejects an unknown value, a non-string and a lowercase near-miss', () => {
    expect(isKnownCapability('SETTLEMENT')).toBe(false);
    expect(isKnownCapability('data_export')).toBe(false);
    expect(isKnownCapability(undefined)).toBe(false);
    expect(isKnownCapability(1)).toBe(false);
  });

  it('labels an unrecognised capability as itself rather than throwing or blanking', () => {
    // The admin surface must still be able to render a capability the API knows and this build
    // does not — hiding it would make the one list whose job is completeness incomplete.
    expect(capabilityLabel('FUTURE_THING')).toBe('FUTURE_THING');
  });
});

describe('the enum carries no drain-path member', () => {
  const FORBIDDEN = [
    'SETTLEMENT',
    'SETTLE',
    'PAYOUT',
    'DETERMINATION',
    'DETERMINE',
    'DROUGHT',
    'FLOOD',
    'PERIL',
  ];

  it.each(FORBIDDEN)('contains no capability mentioning %s', (token) => {
    // Who settles a farmer is Organization.serviceTier -> Policy.settlementMode, FROZEN at
    // inception. A mutable org-keyed toggle on that path would strand an in-flight payout on
    // cover sold under a different plan — the exact bug the tier/mode split prevents.
    for (const capability of CAPABILITIES) {
      expect(capability).not.toContain(token);
    }
  });

  it('matches the backend CAPABILITIES array exactly, in order', () => {
    expect([...CAPABILITIES]).toEqual([
      'CROP_UNDERWRITING',
      'LIVESTOCK_UNDERWRITING',
      'BULK_IMPORT',
      'DATA_EXPORT',
      'PARTNER_WEBHOOKS',
      'PARTNER_API_ACCESS',
      'SANDBOX_SIMULATION',
    ]);
  });

  it('gives every capability a label and a description', () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_LABELS[capability]).toBeTruthy();
      expect(CAPABILITY_DESCRIPTIONS[capability]).toBeTruthy();
    }
  });

  it('exposes the backend refusal code so a caller can branch on it', () => {
    expect(CAPABILITY_NOT_ENABLED).toBe('CAPABILITY_NOT_ENABLED');
  });
});

describe('copy reads as a plan boundary, not a fault', () => {
  it('names the feature rather than the enum value', () => {
    const title = capabilityLockedTitle(CAPABILITY.BULK_IMPORT);
    expect(title).toContain('Bulk farmer/plot import');
    expect(title).not.toContain('BULK_IMPORT');
  });

  it('says it is not on your plan, not that it is broken', () => {
    const title = capabilityLockedTitle(CAPABILITY.DATA_EXPORT);
    expect(title).toMatch(/not on your plan/i);
    expect(title).not.toMatch(/error|fail|unavailable|broken/i);
  });

  it('body says it is a platform-side setting, so the partner does not hunt for a switch', () => {
    const body = capabilityLockedBody(CAPABILITY.DATA_EXPORT);
    expect(body).toMatch(/platform-side setting/i);
    expect(body).toMatch(/microcrop/i);
  });

  it('always offers a next step, and reassures that nothing existing is affected', () => {
    expect(CAPABILITY_LOCKED_NEXT).toMatch(/contact microcrop/i);
    expect(CAPABILITY_LOCKED_NEXT).toMatch(/is affected|unaffected|not affected/i);
  });

  it('unknown copy never claims the partner lacks the capability', () => {
    expect(CAPABILITY_UNKNOWN_TITLE).toMatch(/couldn't confirm/i);
    expect(CAPABILITY_UNKNOWN_BODY).not.toMatch(/not on your plan/i);
    expect(CAPABILITY_UNKNOWN_BODY).toMatch(/nothing is wrong/i);
  });
});

describe('capabilityDisabledReason — a tooltip, and only when there is something to say', () => {
  it('is null when the control is allowed', () => {
    expect(capabilityDisabledReason(CAPABILITY.DATA_EXPORT, 'enabled')).toBeNull();
  });

  it('is null while loading, so a resolving control carries no premature explanation', () => {
    expect(capabilityDisabledReason(CAPABILITY.DATA_EXPORT, 'loading')).toBeNull();
  });

  it('names the plan, not the permission, on a known deny', () => {
    const reason = capabilityDisabledReason(CAPABILITY.DATA_EXPORT, 'unavailable');
    expect(reason).toMatch(/not on your plan/i);
    expect(reason).toMatch(/contact microcrop/i);
    // An ORG_ADMIN with every permission in the system still cannot do this, so pointing at
    // permissions would send the partner to the wrong place.
    expect(reason).not.toMatch(/permission|administrator/i);
  });

  it('offers a retry rather than a plan claim on unknown', () => {
    const reason = capabilityDisabledReason(CAPABILITY.DATA_EXPORT, 'unknown');
    expect(reason).toMatch(/couldn't confirm/i);
    expect(reason).not.toMatch(/not on your plan/i);
  });
});
