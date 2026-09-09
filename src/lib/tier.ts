/**
 * SERVICE TIER — the dashboard mirror of the backend entitlement primitive.
 *
 * MicroCrop is sold as two tiers:
 *
 *   DETERMINATION (Tier 1)                we determine whether the parametric trigger fired and
 *                                         issue a signed, independently verifiable determination
 *                                         plus its evidence package. The PARTNER settles its
 *                                         farmer off-platform, off its own balance sheet.
 *   DETERMINATION_AND_SETTLEMENT (Tier 2) the above, plus we originate and settle the payout.
 *
 * TWO FIELDS, AND USING THE WRONG ONE IS THE BUG THIS MODULE IS SHAPED TO PREVENT.
 *
 *   Organization.serviceTier   what the org bought TODAY. MUTABLE. Gates INTAKE — what may be
 *                              STARTED. Never use it to decide the fate of an existing policy.
 *   Policy.settlementMode      who owes THIS farmer for THIS cover. FROZEN at inception,
 *                              immutable once the policy is ACTIVE. Every per-policy settlement
 *                              decision reads this.
 *
 * "TIER GATES INTAKE, NEVER DRAIN." A downgrade must not strand an in-flight payout on cover
 * sold under Tier 2, and an upgrade must not retroactively make MicroCrop liable for cover it
 * never priced. That is why a payout row is judged on its policy's frozen mode and not on the
 * org's current tier.
 *
 * THE CONDITION IS WRITTEN IN THE POSITIVE, AND SO DENIES BY DEFAULT.
 * Always `=== DETERMINATION_AND_SETTLEMENT`, NEVER `!== DETERMINATION`. With optional chaining
 * that makes `null`, `undefined`, a missing row, a legacy string, a future enum value and the
 * wrong case all land on "not entitled" — the same spelling the backend uses in
 * src/services/entitlement.service.js.
 *
 * THIS IS NOT ENFORCEMENT. The server decides; every one of these paths is gated at a service
 * chokepoint reachable from Bull workers and /api/internal/* that no browser can influence.
 * What this buys is that a partner is never offered a control that will come back 403, and is
 * never shown a settlement feature as if it were broken.
 */
import type { Organization, Policy, ServiceTier } from '@/types';

export const SERVICE_TIER = {
  DETERMINATION: 'DETERMINATION',
  DETERMINATION_AND_SETTLEMENT: 'DETERMINATION_AND_SETTLEMENT',
} as const satisfies Record<string, ServiceTier>;

/** Anything that carries a frozen per-policy settlement mode. */
type SettlementModeCarrier = { settlementMode?: ServiceTier | string | null } | null | undefined;

/** Anything that carries a mutable org-level tier. */
type ServiceTierCarrier = { serviceTier?: ServiceTier | string | null } | null | undefined;

/**
 * Does MicroCrop settle THIS policy? Reads the FROZEN per-policy mode, never the org's tier.
 *
 * Fail-closed: a null, absent, unrecognised or differently-cased mode returns false.
 */
export function isSettlementEntitled(policy: SettlementModeCarrier): boolean {
  return policy?.settlementMode === SERVICE_TIER.DETERMINATION_AND_SETTLEMENT;
}

/**
 * May this organization START a settlement flow at all? Reads the MUTABLE org tier.
 *
 * INTAKE ONLY. Never call this to decide what happens to an existing policy or payout.
 */
export function isOrgSettlementEntitled(org: ServiceTierCarrier): boolean {
  return org?.serviceTier === SERVICE_TIER.DETERMINATION_AND_SETTLEMENT;
}

/** True only for a value that is definitely Tier 1 — an unknown value is NOT Tier 1 either. */
export function isDeterminationOnlyTier(org: ServiceTierCarrier): boolean {
  return org?.serviceTier === SERVICE_TIER.DETERMINATION;
}

/**
 * THREE-VALUED, ON PURPOSE.
 *
 * A boolean cannot express "we do not know yet", and the two ways of not knowing must not be
 * shown the same way:
 *
 *   'loading'   the org has not resolved. Render a skeleton. Rendering either the enabled
 *               control or the "not on your plan" panel here is the flash-of-wrong-state bug —
 *               a Tier 2 partner would see "upgrade to settle" for a beat on every page load.
 *   'unknown'   the org resolved but carries no tier we recognise, or the request failed. FAIL
 *               CLOSED on the action (the server would refuse it anyway) but say honestly that
 *               we could not confirm the plan, and offer a retry. Claiming "not on your plan"
 *               would be a lie we cannot support, and enabling the control would produce a raw
 *               403 — which the brief forbids.
 *   'settlement' / 'determination'   known.
 */
export type TierState = 'loading' | 'unknown' | 'determination' | 'settlement';

export function resolveTierState(
  org: Organization | null | undefined,
  isLoading: boolean,
): TierState {
  // Loading wins while there is no org at all: a partially-loaded query must not be read as a
  // tier answer. Once an org IS in hand a background refetch must NOT knock the answer back to
  // 'loading', or the page flickers on every window focus.
  if (!org) return isLoading ? 'loading' : 'unknown';
  if (isOrgSettlementEntitled(org)) return 'settlement';
  if (isDeterminationOnlyTier(org)) return 'determination';
  return 'unknown';
}

/** Should a settlement control be offered? Only on a positively-known settlement tier. */
export function tierAllowsSettlement(state: TierState): boolean {
  return state === 'settlement';
}

/** Human label for a tier. */
export const SERVICE_TIER_LABELS: Record<ServiceTier, string> = {
  DETERMINATION: 'Determination',
  DETERMINATION_AND_SETTLEMENT: 'Determination & Settlement',
};

export function tierLabel(tier: ServiceTier | string | null | undefined): string {
  if (tier === SERVICE_TIER.DETERMINATION) return SERVICE_TIER_LABELS.DETERMINATION;
  if (tier === SERVICE_TIER.DETERMINATION_AND_SETTLEMENT) {
    return SERVICE_TIER_LABELS.DETERMINATION_AND_SETTLEMENT;
  }
  return 'Unknown';
}

// ---------------------------------------------------------------------------
// COPY
//
// Kept here rather than inline so every surface that has to say "this is not on your plan"
// says it identically, and so the wording can be reviewed in one place. It must read as a
// PLAN BOUNDARY, never as a fault: a partner who sees "unavailable" or a dead button will
// open a support ticket about a bug that does not exist.
//
// It also must not paraphrase the settlement refusal the SERVER writes. Where the API returns
// a `reason` (the Tier 1 branch of the determination projection does), render that verbatim
// and use this copy only for surfaces that have no server sentence to show.
// ---------------------------------------------------------------------------

export const TIER1_PLAN_NAME = 'Determination';

/** Heading for a settlement surface a Tier 1 org cannot use. */
export const TIER1_LOCKED_TITLE = 'Settlement is not part of your plan';

/** Body copy. States what the plan DOES do first, so the page does not read as an outage. */
export const TIER1_LOCKED_BODY =
  'Your organization is on the Determination plan. MicroCrop determines whether the ' +
  'parametric trigger fired and issues a signed determination and evidence package for every ' +
  'policy you sell — and deliberately does not originate or settle any payment. Paying the ' +
  'farmer is your obligation, settled off-platform on your own balance sheet.';

/** Where the partner should go instead. */
export const TIER1_LOCKED_NEXT =
  'Your determinations, the amount each policy owes in its own currency, and the downloadable ' +
  'evidence package are all under Determinations.';

/** The upgrade path. Deliberately a contact route: tier is changed by MicroCrop, not self-serve. */
export const TIER1_UPGRADE_CTA = 'Ask about Determination & Settlement';
export const TIER1_UPGRADE_BODY =
  'On the Determination & Settlement plan MicroCrop originates and settles the payout to the ' +
  'farmer for you. Talk to MicroCrop to change your plan — it is not a self-service switch, ' +
  'because a change only applies to cover sold after it.';

/** Honest copy for the 'unknown' state. Never claims the feature is unavailable to them. */
export const TIER_UNKNOWN_TITLE = "We couldn't confirm your plan";
export const TIER_UNKNOWN_BODY =
  "We couldn't read your organization's service plan, so we have not enabled settlement " +
  'actions on this page. Nothing is wrong with your policies or determinations. Reload to try ' +
  'again, and contact MicroCrop if it keeps happening.';

/**
 * Why a specific settlement CONTROL is disabled, for a tooltip on the control itself. Short
 * enough for a `title`, and it names the plan rather than the permission — a Tier 1 admin with
 * every permission in the system still cannot do this.
 */
export function settlementDisabledReason(state: TierState): string | null {
  if (state === 'determination') {
    return 'Not on your plan. MicroCrop issues the determination; settling the farmer is your ' +
      'organization\'s obligation under the Determination plan.';
  }
  if (state === 'unknown') {
    return "We couldn't confirm your service plan, so settlement actions are disabled. Reload " +
      'to try again.';
  }
  return null;
}
