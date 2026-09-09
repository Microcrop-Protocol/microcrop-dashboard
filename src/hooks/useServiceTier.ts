/**
 * WHAT PLAN IS THIS ORGANIZATION ON, and is it safe to render a settlement control yet?
 *
 * Reads `GET /api/organizations/me`, which returns the whole organization row minus credentials
 * — `serviceTier` is a column on it, so no new endpoint is involved.
 *
 * THE POINT OF THIS HOOK IS THE THREE-VALUED ANSWER, not the fetch. A boolean cannot express
 * "not known yet", and the two ways of not knowing must be rendered differently:
 *
 *   loading  → skeleton. Rendering EITHER the live control or the "not on your plan" panel here
 *              is the flash-of-wrong-state bug: on a Tier 2 partner's dashboard every page load
 *              would show "upgrade to settle" for a beat, which reads as a downgrade or a
 *              billing fault and generates a support ticket about nothing.
 *   unknown  → the org resolved with no tier we recognise, or the request failed. Fail closed on
 *              the ACTION (the server would refuse it anyway) but say honestly that we could not
 *              confirm the plan. Claiming "not on your plan" would be an assertion we cannot
 *              support; enabling the control would produce a raw 403.
 *
 * A background refetch must NOT knock a resolved answer back to `loading`, or every window focus
 * re-flashes the page — hence `resolveTierState` keys on whether an org is in hand, and the
 * query keeps a long `staleTime` (a tier changes about once in a partner's lifetime, and only a
 * platform admin can change it).
 *
 * SCOPE. Use this for INTAKE decisions — may this org start a settlement flow at all. For an
 * existing policy or payout, read that row's frozen `settlementMode` with
 * `isSettlementEntitled` instead: a tier downgrade must never strand an in-flight payout on
 * cover that was sold under Tier 2.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  resolveTierState,
  settlementDisabledReason,
  tierAllowsSettlement,
  type TierState,
} from '@/lib/tier';
import type { Organization, ServiceTier } from '@/types';

export interface ServiceTierInfo {
  /** The only value a caller should branch on. */
  state: TierState;
  tier: ServiceTier | null;
  organization: Organization | undefined;
  /** True ONLY on a positively-known settlement tier. Never true while loading or unknown. */
  canSettle: boolean;
  /** True ONLY on a positively-known Determination tier — an unknown tier is not Tier 1 either. */
  isDeterminationOnly: boolean;
  /** Nothing is known yet; render a skeleton rather than either answer. */
  isLoading: boolean;
  /** Short sentence for a disabled control's tooltip, or null when the control is allowed. */
  disabledReason: string | null;
  /** Lets an "unknown" panel offer a real retry instead of telling the user to reload. */
  refetch: () => void;
}

export function useServiceTier(): ServiceTierInfo {
  const user = useAuthStore((s) => s.user);
  // Platform admins operate across orgs and have no single service tier of their own; the
  // org-scoped endpoint would 401/404 for them, so the call is skipped rather than left to fail
  // and land every platform screen in the `unknown` branch.
  const enabled = Boolean(user?.organizationId) && user?.role !== 'PLATFORM_ADMIN';

  const { data, isLoading, refetch } = useQuery<Organization>({
    queryKey: ['my-organization', user?.organizationId],
    queryFn: () => api.getMyOrganization(),
    enabled,
    // A service tier changes rarely and only by platform action. A long staleTime keeps a
    // resolved answer stable across navigation, which is what stops the flicker.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const state = resolveTierState(data, enabled && isLoading);
  const tier = state === 'settlement' || state === 'determination'
    ? (data?.serviceTier as ServiceTier)
    : null;

  return {
    state,
    tier: tier ?? null,
    organization: data,
    canSettle: tierAllowsSettlement(state),
    isDeterminationOnly: state === 'determination',
    isLoading: state === 'loading',
    disabledReason: settlementDisabledReason(state),
    refetch: () => void refetch(),
  };
}
