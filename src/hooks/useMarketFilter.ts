/**
 * The market a platform-admin screen is filtered to, kept in the URL (`?market=GH`) so a filtered
 * view survives a reload and can be shared. See lib/market-filter for the two modes and why money
 * screens cannot be set to "All markets".
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MARKET_SEARCH_PARAM,
  countryCodeParam,
  marketForFilter,
  parseMarketFilter,
  type MarketFilter,
  type MarketFilterMode,
} from '@/lib/market-filter';
import type { CountryCode, Market } from '@/lib/market';

export interface MarketFilterState {
  value: MarketFilter;
  setValue: (next: MarketFilter) => void;
  /** What to send as `?countryCode=`; undefined for all markets. */
  countryCode: CountryCode | undefined;
  /** The selected market, or null for all markets. */
  market: Market | null;
}

export function useMarketFilter(mode: MarketFilterMode): MarketFilterState {
  const [params, setParams] = useSearchParams();
  const value = parseMarketFilter(params.get(MARKET_SEARCH_PARAM), mode);

  const setValue = useCallback(
    (next: MarketFilter) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev);
          updated.set(MARKET_SEARCH_PARAM, next);
          return updated;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { value, setValue, countryCode: countryCodeParam(value), market: marketForFilter(value) };
}
