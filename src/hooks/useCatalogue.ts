/**
 * WHAT DOES THIS ORGANIZATION'S MARKET LIST, and is it safe to fill a picker yet?
 *
 * Reads `GET /api/catalogue`. For an organization user the server returns ONLY that
 * organization's market, so the answer is already scoped; this hook picks it out (matching the
 * organization's country code once `useOrgMarket` has it) and reads it with lib/catalogue.ts.
 *
 * ONE QUERY FOR THE WHOLE APP. The catalogue is the same for every screen of an organization and
 * changes when MicroCrop graduates a product — rarely, and never while a partner is mid-form — so
 * every picker reads one `['catalogue', orgId]` cache entry with a long staleTime.
 *
 * THE THREE-VALUED ANSWER IS THE POINT, as in useCapabilities and useOrgMarket:
 *
 *   loading  → render a skeleton or an empty picker. Offering a list before the market's own list
 *              arrives is how a field agent registers a plot the server then refuses.
 *   unknown  → the request failed or carried no market for this organization. Offer NOTHING and
 *              say the list could not be loaded, with a retry. Never fall back to a Kenyan list.
 *   known    → `market` is non-null; `crops` and `livestock` are its lines.
 *
 * NOT ENFORCEMENT. The server refuses an unlisted type on plot/herd creation
 * (PRODUCT_NOT_IN_MARKET) and an unsellable one on quote and purchase (PRODUCT_NOT_OFFERED)
 * regardless. This exists so a partner is never offered a choice that comes back refused.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useOrgMarket } from '@/hooks/useOrgMarket';
import {
  catalogueItems,
  lineOffered,
  resolveCatalogueState,
  selectMarketCatalogue,
  type CatalogueState,
} from '@/lib/catalogue';
import type { CatalogueItem, CatalogueMarket } from '@/types/catalogue';

export interface OrgCatalogueInfo {
  /** The only value a caller should branch on. */
  state: CatalogueState;
  /** Non-null ONLY when `state === 'known'`. */
  market: CatalogueMarket | null;
  /** The market's CROP line. Empty unless known. */
  crops: CatalogueItem[];
  /** The market's LIVESTOCK line. Empty unless known — and empty in a market that hides it. */
  livestock: CatalogueItem[];
  /**
   * Does the market list livestock at all? Null unless known, so "not loaded" can never be read
   * as "not offered here".
   */
  livestockOffered: boolean | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useCatalogue(): OrgCatalogueInfo {
  const user = useAuthStore((s) => s.user);
  // Organization users only, matching useOrgMarket. A platform admin has no market of its own;
  // the same endpoint returns every market to it, and platform screens read that directly.
  const enabled = Boolean(user?.organizationId) && user?.role !== 'PLATFORM_ADMIN';
  const { countryCode } = useOrgMarket();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['catalogue', user?.organizationId ?? null],
    queryFn: () => api.getCatalogue(),
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const selected = selectMarketCatalogue(data, countryCode);
  const state = resolveCatalogueState(selected, Boolean(data), enabled && isLoading);
  const market = state === 'known' ? selected : null;

  return {
    state,
    market,
    crops: catalogueItems(market, 'CROP'),
    livestock: catalogueItems(market, 'LIVESTOCK'),
    livestockOffered: lineOffered(market, 'LIVESTOCK'),
    isLoading: state === 'loading',
    refetch: () => void refetch(),
  };
}

/**
 * Is livestock POSITIVELY KNOWN not to be offered in this organization's market? Returns the
 * country's name when it is, else null.
 *
 * Two sources, either sufficient: the market registry (`livestockEnabled: false`) and the
 * catalogue (an empty LIVESTOCK line). Both must be KNOWN answers — a loading or failed read
 * returns null, so neither can produce a "not offered in your country" claim we have not
 * confirmed. Ghana is the live case: the line is hidden there, not merely unsold.
 */
export function useLivestockNotOffered(): string | null {
  return useLivestockGate().notOfferedIn;
}

export interface LivestockGate {
  /**
   * True once both the organization's market and its catalogue have answered (known, or failed).
   * A livestock screen must not request herds or alerts before this: in Ghana that request is
   * one the page is about to replace with "not offered" — a wasted call against a product the
   * market does not have, and a flash of an empty herd table.
   */
  resolved: boolean;
  /** As useLivestockNotOffered: the country's name when livestock is KNOWN not to be offered. */
  notOfferedIn: string | null;
}

/** The livestock screens' gate: whether to ask for livestock data yet, and whether to at all. */
export function useLivestockGate(): LivestockGate {
  const { state: marketState, market } = useOrgMarket();
  const { state: catalogueState, livestockOffered, market: catalogue } = useCatalogue();

  if (marketState === 'known' && market && !market.livestockEnabled) {
    return { resolved: true, notOfferedIn: market.countryName };
  }
  if (catalogue && livestockOffered === false) return { resolved: true, notOfferedIn: catalogue.countryName };
  return { resolved: marketState !== 'loading' && catalogueState !== 'loading', notOfferedIn: null };
}
