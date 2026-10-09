/**
 * WHAT IS ENABLED FOR THIS ORGANIZATION, and is it safe to offer the control yet?
 *
 * Reads `GET /organizations/me/capabilities`, which returns a COMPLETE map over every capability
 * the backend knows — including the ones with no grant row, reported `enabled: false`, because
 * absence of a row is a deny server-side. Completeness is what lets the dashboard answer without
 * guessing about an absent key.
 *
 * ONE QUERY FOR THE WHOLE PAGE. Every gate on a page reads the same `['my-capabilities']` cache
 * entry, so gating six controls costs one request. That matters for the flash: a per-control
 * query would resolve at six different moments and the page would settle in stages.
 *
 * THE THREE-VALUED ANSWER IS THE POINT, exactly as in useServiceTier. See lib/capability.ts for
 * what each state means and why 'unavailable' and 'unknown' must not share copy.
 *
 * PLATFORM ADMINS have no capabilities of their own — they are not a tenant — so the query is
 * skipped and every capability resolves to `unknown`. A platform screen must not gate itself on
 * an org capability; it reads the org's map through `platformGetOrgCapabilities` instead.
 *
 * NOT ENFORCEMENT. The server refuses at its service chokepoints regardless. This exists so the
 * partner is never offered a control that comes back 403.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  capabilityAllows,
  capabilityDisabledReason,
  resolveCapabilityState,
  type CapabilityState,
} from '@/lib/capability';
import type { OrgCapability, OrgCapabilityStatus } from '@/types';

export interface CapabilityInfo {
  /** The only value a caller should branch on. */
  state: CapabilityState;
  /** True ONLY on a positively-known grant. Never true while loading or unknown. */
  allowed: boolean;
  /** Nothing is known yet; render a skeleton rather than either answer. */
  isLoading: boolean;
  /** Short sentence for a disabled control's tooltip, or null when the control is allowed. */
  disabledReason: string | null;
  /** Lets an "unknown" panel offer a real retry instead of telling the user to reload. */
  refetch: () => void;
}

export interface CapabilitiesInfo {
  statuses: OrgCapabilityStatus[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Resolve any capability's state from the one fetched map. */
  stateOf: (capability: OrgCapability) => CapabilityState;
  refetch: () => void;
}

/** The underlying query, shared by every gate on the page. */
export function useCapabilities(): CapabilitiesInfo {
  const user = useAuthStore((s) => s.user);
  const enabled = Boolean(user?.organizationId) && user?.role !== 'PLATFORM_ADMIN';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-capabilities', user?.organizationId],
    queryFn: () => api.getMyCapabilities(),
    enabled,
    // A capability is flipped by a platform admin, by hand, with a written reason. It does not
    // change while a partner is looking at a page, and a long staleTime is what keeps a resolved
    // answer stable across navigation — which is what stops the flicker.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const statuses = data?.capabilities;

  return {
    statuses,
    isLoading: enabled && isLoading,
    // A platform admin is not an error case — but it is not a knowable answer either, so it
    // lands on `unknown` via the null statuses below rather than on a false `enabled`.
    isError,
    stateOf: (capability: OrgCapability) =>
      resolveCapabilityState(capability, statuses, enabled && isLoading, isError),
    refetch: () => void refetch(),
  };
}

/** One capability, resolved. The hook most call sites want. */
export function useCapability(capability: OrgCapability): CapabilityInfo {
  const { stateOf, refetch } = useCapabilities();
  const state = stateOf(capability);

  return {
    state,
    allowed: capabilityAllows(state),
    isLoading: state === 'loading',
    disabledReason: capabilityDisabledReason(capability, state),
    refetch,
  };
}
