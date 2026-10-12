/**
 * ORG CAPABILITIES — the dashboard mirror of microcrop-backend/src/services/capability.service.js.
 *
 * A capability is a PLATFORM-SIDE switch for what a partner may DO: sell crop cover, sell
 * livestock cover, bulk-import farmers, export its data, receive webhooks, call the partner API,
 * use the sandbox. A platform admin flips it, with a mandatory reason, and the backend records
 * who/when/why in OrgCapabilityChange.
 *
 * THIS IS THE SAME SHAPE AS lib/tier.ts, ON PURPOSE. The repo already had one three-valued
 * entitlement primitive and inventing a second idiom for the second one would mean two sets of
 * "not on your plan" copy, two loading conventions and two ways to get the fail-closed condition
 * subtly wrong. So: the condition is written in the positive, the state is three-valued, and the
 * copy lives at the bottom of the file.
 *
 * WHAT A CAPABILITY IS NOT. It is not the service tier and it is not a permission.
 *
 *   serviceTier   WHO SETTLES a farmer. Mutable at the org, FROZEN per policy as
 *                 Policy.settlementMode. See lib/tier.ts. Capabilities deliberately contain no
 *                 settlement/payout/determination member — the backend enforces that
 *                 structurally with a test — because a mutable org-keyed toggle on the drain
 *                 path would strand cover already sold.
 *   permission    WHICH USER within the org may do it (lib/permissions.ts, `export:read` and
 *                 friends). Orthogonal: an ORG_ADMIN with every permission in the system still
 *                 cannot export if the ORGANIZATION lacks DATA_EXPORT, and a Viewer cannot
 *                 export even when the organization has it. BOTH must pass, and they need
 *                 different copy — "ask your administrator" vs "contact MicroCrop".
 *
 * THE CONDITION IS WRITTEN IN THE POSITIVE, AND SO DENIES BY DEFAULT.
 * Always `enabled === true`, NEVER `enabled !== false`. A missing entry, `null`, `undefined`,
 * the string `'true'`, `1`, and a capability this build does not recognise all land on "not
 * entitled" — the same spelling `isCapabilityEnabled` uses server-side. ABSENCE IS A DENY there
 * (no OrgCapabilityGrant row means refused), so absence must be a deny here too, or the
 * dashboard would offer a control the server refuses.
 *
 * THIS IS NOT ENFORCEMENT. Every load-bearing check is an `assertCapability` at a backend
 * service chokepoint reachable from Bull workers and /api/internal/* that no browser can
 * influence. What this buys is that a partner is never offered a control that comes back 403,
 * and is never shown a feature it does not have as if it were broken.
 */
import type { OrgCapability, OrgCapabilityStatus } from '@/types';

export const CAPABILITY = {
  CROP_UNDERWRITING: 'CROP_UNDERWRITING',
  LIVESTOCK_UNDERWRITING: 'LIVESTOCK_UNDERWRITING',
  BULK_IMPORT: 'BULK_IMPORT',
  DATA_EXPORT: 'DATA_EXPORT',
  PARTNER_WEBHOOKS: 'PARTNER_WEBHOOKS',
  PARTNER_API_ACCESS: 'PARTNER_API_ACCESS',
  SANDBOX_SIMULATION: 'SANDBOX_SIMULATION',
} as const satisfies Record<string, OrgCapability>;

/**
 * Every capability this build knows about, in the order the backend's CAPABILITIES array lists
 * them — so the admin toggle list and the partner's own "what's on my plan" list are ordered
 * identically to the API response and do not reshuffle between reloads.
 */
export const CAPABILITIES: readonly OrgCapability[] = Object.freeze([
  CAPABILITY.CROP_UNDERWRITING,
  CAPABILITY.LIVESTOCK_UNDERWRITING,
  CAPABILITY.BULK_IMPORT,
  CAPABILITY.DATA_EXPORT,
  CAPABILITY.PARTNER_WEBHOOKS,
  CAPABILITY.PARTNER_API_ACCESS,
  CAPABILITY.SANDBOX_SIMULATION,
]);

/** The error code the backend returns on a capability refusal. */
export const CAPABILITY_NOT_ENABLED = 'CAPABILITY_NOT_ENABLED';

export function isKnownCapability(value: unknown): value is OrgCapability {
  return typeof value === 'string' && (CAPABILITIES as readonly string[]).includes(value);
}

/** Labels, matching CAPABILITY_LABELS server-side so a refusal message and a toggle agree. */
export const CAPABILITY_LABELS: Record<OrgCapability, string> = {
  CROP_UNDERWRITING: 'Crop underwriting',
  LIVESTOCK_UNDERWRITING: 'Livestock (IBLI) underwriting',
  BULK_IMPORT: 'Bulk farmer/plot import',
  DATA_EXPORT: 'Data export',
  PARTNER_WEBHOOKS: 'Partner webhooks',
  PARTNER_API_ACCESS: 'Partner API access',
  SANDBOX_SIMULATION: 'Sandbox simulated payments',
};

export function capabilityLabel(capability: OrgCapability | string): string {
  return isKnownCapability(capability) ? CAPABILITY_LABELS[capability] : capability;
}

/**
 * What each capability actually unlocks, for the platform-admin toggle list. An operator about
 * to switch something off needs to know what stops working; "Partner webhooks: off" alone does
 * not say that in-flight deliveries also stop being retried.
 */
export const CAPABILITY_DESCRIPTIONS: Record<OrgCapability, string> = {
  CROP_UNDERWRITING:
    'Quote and sell crop cover. Off means no new crop policy can be quoted or purchased. ' +
    'Cover already sold is unaffected — this gates intake only.',
  // What else gates livestock is the MARKET'S PRODUCT CATALOGUE, not a fixed "crop-only" rule:
  // a market sells only the livestock its catalogue lists. Ghana's lists none today.
  LIVESTOCK_UNDERWRITING:
    'Quote and sell livestock cover. Also requires the organization\'s market to list livestock ' +
    'in its product catalogue — this switch has no effect in a market that lists none (Ghana, today).',
  BULK_IMPORT:
    'CSV/JSON bulk import of farmers and plots. Off means only one-at-a-time onboarding. ' +
    'High-volume PII intake, so it is off for new organizations by default.',
  DATA_EXPORT: 'CSV export of farmers, policies, payouts and transactions.',
  PARTNER_WEBHOOKS:
    'Outbound webhook delivery to the partner-supplied URL, and manual retry of a failed ' +
    'delivery. Off means no delivery is attempted and none is recorded.',
  PARTNER_API_ACCESS:
    'Authentication with the organization API key (x-api-key). Also requires the organization ' +
    "not to have revoked its own key. Off means every API-key request is refused; the partner's " +
    'dashboard logins are unaffected.',
  SANDBOX_SIMULATION:
    'Simulated payments for integration testing. Also requires the environment to permit ' +
    'simulation, so this can never move real money and can never be on in production.',
};

/**
 * THREE-VALUED, for the same reasons as TierState — and the two ways of not knowing must not be
 * rendered the same way:
 *
 *   'loading'    the capability map has not resolved. Render a skeleton. Rendering EITHER the
 *                live control or the "not on your plan" panel here is the flash-of-wrong-state
 *                bug the brief forbids: a partner who HAS bulk import would see "not on your
 *                plan" for a beat on every page load, which reads as a downgrade.
 *   'unavailable' the map resolved and this capability is off, or it is a capability this build
 *                does not recognise. Say "not on your plan" and give the next step.
 *   'unknown'    the request failed, so we could not read the map at all. FAIL CLOSED on the
 *                action (the server would refuse it anyway) but say honestly that we could not
 *                confirm, and offer a retry. Claiming "not on your plan" would be a lie we
 *                cannot support; enabling the control would produce the raw 403.
 *   'enabled'    positively known to be on.
 */
export type CapabilityState = 'loading' | 'unknown' | 'unavailable' | 'enabled';

/**
 * Resolve one capability to a state.
 *
 * `statuses` is the array from `GET /organizations/me/capabilities`, which is COMPLETE over
 * every capability the backend knows — so a capability missing from it is a capability this
 * build and the backend disagree about, which is `unavailable`, not `unknown`: the backend did
 * answer, and its answer did not include a grant.
 */
export function resolveCapabilityState(
  capability: OrgCapability,
  statuses: OrgCapabilityStatus[] | null | undefined,
  isLoading: boolean,
  isError: boolean,
): CapabilityState {
  if (isError) return 'unknown';
  if (!statuses) return isLoading ? 'loading' : 'unknown';
  const entry = statuses.find((s) => s.capability === capability);
  // `=== true`, never `!== false`: an absent entry, a null and a stringy 'true' all deny.
  return entry?.enabled === true ? 'enabled' : 'unavailable';
}

/** Should the control be offered? Only on a positively-known grant. */
export function capabilityAllows(state: CapabilityState): boolean {
  return state === 'enabled';
}

// ---------------------------------------------------------------------------
// COPY
//
// Centralised for the same reason lib/tier.ts centralises its copy: every surface that has to
// say "this is not on your plan" must say it identically, and the wording must read as a PLAN
// BOUNDARY rather than a fault. A partner who sees "unavailable", an error toast or a dead
// button opens a support ticket about a bug that does not exist.
//
// The backend's own refusal sentence (capabilityRefusalMessage) already says the right thing and
// names the right remedy. These strings are deliberately CONSISTENT with it rather than a
// paraphrase — "this is a platform-side setting, contact MicroCrop" is the one actionable fact,
// because a capability is not self-serve.
// ---------------------------------------------------------------------------

/** Heading for a surface the organization does not have. Names the feature, not the enum. */
export function capabilityLockedTitle(capability: OrgCapability | string): string {
  return `${capabilityLabel(capability)} is not on your plan`;
}

/**
 * Body copy. States what IS true first ("your organization does not have this enabled") and
 * then the one thing the partner can do about it, which is not a self-service switch.
 */
export function capabilityLockedBody(capability: OrgCapability | string): string {
  return (
    `Your organization does not have ${capabilityLabel(capability).toLowerCase()} enabled. ` +
    'This is a platform-side setting rather than something you can switch on yourself — ' +
    'MicroCrop enables it per organization.'
  );
}

/** The next step. Deliberately a contact route: only a platform admin can grant a capability. */
export const CAPABILITY_LOCKED_NEXT =
  'Contact MicroCrop to have it enabled for your organization. Nothing about your existing ' +
  'policies, farmers or determinations is affected in the meantime.';

/** Honest copy for the 'unknown' state. Never claims the partner lacks the capability. */
export const CAPABILITY_UNKNOWN_TITLE = "We couldn't confirm what your plan includes";
export const CAPABILITY_UNKNOWN_BODY =
  "We couldn't read your organization's enabled features, so we have not enabled the actions " +
  'on this page. Nothing is wrong with your data. Try again, and contact MicroCrop if it keeps ' +
  'happening.';

/**
 * Why a specific control is disabled, short enough for a tooltip. Names the PLAN rather than the
 * permission — an ORG_ADMIN with every permission in the system still cannot do this.
 */
export function capabilityDisabledReason(
  capability: OrgCapability | string,
  state: CapabilityState,
): string | null {
  if (state === 'unavailable') {
    return `Not on your plan. ${capabilityLabel(capability)} is not enabled for your organization — contact MicroCrop to enable it.`;
  }
  if (state === 'unknown') {
    return "We couldn't confirm your plan, so this is disabled. Try again in a moment.";
  }
  return null;
}
