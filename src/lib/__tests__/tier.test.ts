/**
 * SERVICE TIER — dashboard entitlement mirror.
 *
 * These pin the two properties that make this module worth having, both of which fail silently
 * and expensively if they regress:
 *
 *   1. FAIL-CLOSED. Every way of not being a known settlement tier — null, undefined, missing
 *      field, a legacy string, wrong case, a future enum value — must land on "not entitled".
 *      The condition is written in the positive (=== SETTLEMENT) precisely so it does; a
 *      !== DETERMINATION spelling would let every unknown value through as entitled.
 *   2. INTAKE vs DRAIN. A per-policy decision must read the FROZEN Policy.settlementMode, never
 *      the mutable Organization.serviceTier. Reading the org tier for a policy decision is what
 *      would let a downgrade strand an in-flight payout on cover sold and priced under Tier 2.
 *
 * This is not enforcement — the server gates every path at a service chokepoint. What it buys
 * is that a partner is never offered a control that returns 403, and never sees a plan
 * boundary rendered as an outage.
 */
import { describe, it, expect } from 'vitest';
import {
  SERVICE_TIER,
  isSettlementEntitled,
  isOrgSettlementEntitled,
  isDeterminationOnlyTier,
  resolveTierState,
  tierAllowsSettlement,
  tierLabel,
  settlementDisabledReason,
} from '../tier';

const NOT_KNOWN_SETTLEMENT = [
  null,
  undefined,
  {},
  { settlementMode: null, serviceTier: null },
  { settlementMode: undefined, serviceTier: undefined },
  { settlementMode: '', serviceTier: '' },
  { settlementMode: 'DETERMINATION', serviceTier: 'DETERMINATION' },
  { settlementMode: 'determination_and_settlement', serviceTier: 'determination_and_settlement' },
  { settlementMode: 'DETERMINATION_AND_SETTLEMENT ', serviceTier: 'DETERMINATION_AND_SETTLEMENT ' },
  { settlementMode: 'SETTLEMENT', serviceTier: 'SETTLEMENT' },
  { settlementMode: 'FUTURE_TIER_3', serviceTier: 'FUTURE_TIER_3' },
  { settlementMode: 0, serviceTier: 0 },
  { settlementMode: true, serviceTier: true },
];

describe('fail-closed: only an exact settlement value is entitled', () => {
  it.each(NOT_KNOWN_SETTLEMENT.map((v, i) => [i, v]))(
    'case %i is NOT settlement-entitled at policy level',
    (_i, value) => {
      expect(isSettlementEntitled(value as never)).toBe(false);
    },
  );

  it.each(NOT_KNOWN_SETTLEMENT.map((v, i) => [i, v]))(
    'case %i is NOT settlement-entitled at org level',
    (_i, value) => {
      expect(isOrgSettlementEntitled(value as never)).toBe(false);
    },
  );

  it('the exact value IS entitled, at both levels', () => {
    expect(isSettlementEntitled({ settlementMode: SERVICE_TIER.DETERMINATION_AND_SETTLEMENT })).toBe(true);
    expect(isOrgSettlementEntitled({ serviceTier: SERVICE_TIER.DETERMINATION_AND_SETTLEMENT })).toBe(true);
  });

  it('an unknown value is not Tier 1 either — unknown is its own state, not a synonym', () => {
    expect(isDeterminationOnlyTier({ serviceTier: 'FUTURE_TIER_3' } as never)).toBe(false);
    expect(isDeterminationOnlyTier(null)).toBe(false);
    expect(isDeterminationOnlyTier({ serviceTier: SERVICE_TIER.DETERMINATION })).toBe(true);
  });
});

describe('intake vs drain: a policy decision never reads the org tier', () => {
  it('a Tier 2 policy stays settleable after the org is downgraded to Tier 1', () => {
    // The scenario the freeze exists for: cover sold, priced and premium-collected under
    // Tier 2, then a commercial downgrade months later. The in-flight payout must not stall.
    const org = { serviceTier: SERVICE_TIER.DETERMINATION };
    const policySoldUnderTier2 = { settlementMode: SERVICE_TIER.DETERMINATION_AND_SETTLEMENT };

    expect(isOrgSettlementEntitled(org)).toBe(false);
    expect(isSettlementEntitled(policySoldUnderTier2)).toBe(true);
  });

  it('an upgrade does not reach backwards into cover sold under Tier 1', () => {
    const org = { serviceTier: SERVICE_TIER.DETERMINATION_AND_SETTLEMENT };
    const policySoldUnderTier1 = { settlementMode: SERVICE_TIER.DETERMINATION };

    expect(isOrgSettlementEntitled(org)).toBe(true);
    expect(isSettlementEntitled(policySoldUnderTier1)).toBe(false);
  });
});

describe('resolveTierState is three-valued, and loading is not a tier answer', () => {
  it('no org while loading is loading, not unknown', () => {
    expect(resolveTierState(null, true)).toBe('loading');
    expect(resolveTierState(undefined, true)).toBe('loading');
  });

  it('no org once settled is unknown, not a tier', () => {
    expect(resolveTierState(null, false)).toBe('unknown');
  });

  it('a background refetch does NOT knock a resolved org back to loading', () => {
    // Otherwise the page flickers "upgrade to settle" at a Tier 2 partner on every window focus.
    const org = { serviceTier: SERVICE_TIER.DETERMINATION_AND_SETTLEMENT } as never;
    expect(resolveTierState(org, true)).toBe('settlement');
  });

  it('an org with an unrecognised tier is unknown, never settlement', () => {
    expect(resolveTierState({ serviceTier: 'FUTURE_TIER_3' } as never, false)).toBe('unknown');
    expect(resolveTierState({} as never, false)).toBe('unknown');
  });

  it('only a positively-known settlement tier offers the control', () => {
    expect(tierAllowsSettlement('settlement')).toBe(true);
    expect(tierAllowsSettlement('determination')).toBe(false);
    expect(tierAllowsSettlement('unknown')).toBe(false);
    expect(tierAllowsSettlement('loading')).toBe(false);
  });
});

describe('copy never renders a plan boundary as a fault', () => {
  it('the Tier 1 disabled reason names the plan, not a permission or an error', () => {
    const reason = settlementDisabledReason('determination');
    expect(reason).toBeTruthy();
    expect(reason).toMatch(/not on your plan/i);
    // A Tier 1 admin holds every permission in the system and still cannot settle, so blaming
    // permissions would send them to change a role that will not help.
    expect(reason).not.toMatch(/permission|unauthori|forbidden|error|failed/i);
  });

  it('the unknown reason is honest — it does not claim they lack the plan', () => {
    const reason = settlementDisabledReason('unknown');
    expect(reason).toMatch(/couldn't confirm/i);
    expect(reason).not.toMatch(/not on your plan/i);
  });

  it('an entitled tier disables nothing', () => {
    expect(settlementDisabledReason('settlement')).toBeNull();
    expect(settlementDisabledReason('loading')).toBeNull();
  });

  it('an unrecognised tier labels as Unknown rather than guessing', () => {
    expect(tierLabel('FUTURE_TIER_3')).toBe('Unknown');
    expect(tierLabel(null)).toBe('Unknown');
    expect(tierLabel(SERVICE_TIER.DETERMINATION)).toMatch(/determination/i);
  });
});
