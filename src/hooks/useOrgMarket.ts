/**
 * WHICH MARKET IS THIS ORGANIZATION IN, and is it safe to put a currency on a number yet?
 *
 * Reads `GET /organizations/me`, which returns the whole organization row minus credentials —
 * `countryCode` is a column on it, so no new endpoint is involved. It shares the
 * `['my-organization']` query key with `useServiceTier`, so a page that needs both the tier and
 * the market makes ONE request, not two.
 *
 * THE POINT OF THIS HOOK IS THE THREE-VALUED ANSWER, not the fetch, for the same reason as
 * useServiceTier — and the money case is sharper than the tier case:
 *
 *   loading  → the amount renders with NO currency token (or a skeleton). Rendering 'KES' here
 *              is the flash-of-wrong-state bug, and on a money figure it is worse than on a
 *              feature panel: a Ghanaian partner would see its own premiums labelled in Kenyan
 *              shillings for a beat on every page load, which reads as a data fault.
 *   unknown  → the org resolved with a country we do not recognise, or the request failed. Show
 *              the number, do NOT name a currency. An unlabelled number is incomplete; a wrong
 *              currency symbol is a false statement about money.
 *   known    → `market` is non-null and everything can be labelled.
 *
 * A background refetch must NOT knock a resolved answer back to `loading`, so the state keys on
 * whether an org is in hand and the query keeps a long staleTime — a country code changes about
 * once in an organization's lifetime.
 *
 * PLATFORM ADMINS HAVE NO MARKET OF THEIR OWN. They operate across organizations, the org-scoped
 * endpoint would 401/404 for them, so the call is skipped and the state is `unknown` rather than
 * a wrong guess. A platform screen that needs a market must read the market of the organization
 * it is displaying — see `useMarketFor`.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  level1Label,
  level2Label,
  marketOrNull,
  mobileMoneyLabel,
  resolveMarketState,
  type Market,
  type MarketState,
} from '@/lib/market';
import type { Organization } from '@/types';

export interface OrgMarketInfo {
  /** The only value a caller should branch on. */
  state: MarketState;
  /** Non-null ONLY when `state === 'known'`. Never a guessed fallback. */
  market: Market | null;
  countryCode: string | null;
  organization: Organization | undefined;
  /** Nothing is known yet; render a skeleton rather than an unlabelled or wrong figure. */
  isLoading: boolean;
  /** What to call the `county` column here. Safe to render while loading — it is a label. */
  level1Label: string;
  /** What to call the `subCounty` column here. */
  level2Label: string;
  /** What to call the mobile-money prompt. 'mobile money' when unknown, never 'M-Pesa'. */
  mobileMoneyLabel: string;
  refetch: () => void;
}

export function useOrgMarket(): OrgMarketInfo {
  const user = useAuthStore((s) => s.user);
  const enabled = Boolean(user?.organizationId) && user?.role !== 'PLATFORM_ADMIN';

  const { data, isLoading, refetch } = useQuery<Organization>({
    queryKey: ['my-organization', user?.organizationId],
    queryFn: () => api.getMyOrganization(),
    enabled,
    // Same key and staleTime as useServiceTier so the two hooks share one request and one
    // cached answer. A country code changes about never.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const countryCode = data?.countryCode ?? null;
  const state = resolveMarketState(countryCode, enabled && isLoading, Boolean(data));
  const market = state === 'known' ? marketOrNull(countryCode) : null;

  return {
    state,
    market,
    countryCode,
    organization: data,
    isLoading: state === 'loading',
    // Labels may default — being wrong says "County" to a Ghanaian rather than making a false
    // claim about money. See the note on level1Label in lib/market.
    level1Label: level1Label(market),
    level2Label: level2Label(market),
    mobileMoneyLabel: mobileMoneyLabel(market),
    refetch: () => void refetch(),
  };
}

/**
 * The market of a SPECIFIC organization whose row is already in hand — for platform-admin
 * screens, which have no market of their own but are looking at an org that does.
 *
 * Returns null rather than defaulting, so a caller renders an unlabelled figure instead of
 * asserting Kenyan shillings over a Ghanaian partner's premiums.
 */
export function useMarketFor(
  organization: { countryCode?: string | null } | null | undefined,
): Market | null {
  return marketOrNull(organization?.countryCode);
}
