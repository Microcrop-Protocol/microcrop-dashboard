/**
 * KYB REVIEW — which market an organization under review belongs to, for the platform reviewer.
 *
 * The market decides which regulator must have licensed the organization (IRA in Kenya, NIC in
 * Ghana) and which documents its checklist requires. A reviewer approving a Ghanaian insurer
 * against Kenya's regulator is approving the wrong thing, so the country is shown on every review
 * card and an organization with no recognised market is shown as UNKNOWN, never as Kenya.
 *
 * THE REGULATOR IS READ FROM EXACTLY THE FIELD THE BACKEND SENDS. kyb.service
 * `listOrgKybReviews` spreads each organization row and adds `countryName`, `regulator` (the
 * short code — 'IRA', 'NIC') and `regulatorName` from the market registry, and sends
 * `regulator: null` — deliberately — for an organization whose country is not a supported market,
 * so the reviewer is not sent to the wrong register. A null the server sent is therefore an
 * answer and is kept; the dashboard's market mirror is consulted only when the key is ABSENT (an
 * older backend). The required-document LIST is never mirrored: it comes from
 * `GET /platform/organizations/:orgId/kyb` → `checklist`, built server-side.
 */
import { MARKETS, marketOrNull, type Market } from './market';
import { ALL_MARKETS, divisionLabelForFilter } from './market-filter';
import type { OrgKybReview } from '@/types';

export interface KybReviewMarket {
  /** True when the organization's country is a market this build recognises. */
  known: boolean;
  countryCode: string | null;
  /** "Ghana"; the raw code for an unrecognised market; null when the org has none. */
  countryName: string | null;
  /** "NIC"; null when the server says there is none, or neither it nor a recognised market names one. */
  regulator: string | null;
  /** "National Insurance Commission", when the server names it. */
  regulatorName: string | null;
  /**
   * What to call the organization's `county`: the market's own label (County / Region), and for
   * an organization with no recognised market a label that does not pretend to be Kenya's.
   */
  level1Label: string;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** Unknown market: every label the registry carries ("County / Region"), never Kenya's alone. */
const UNKNOWN_MARKET_LEVEL1 = divisionLabelForFilter(ALL_MARKETS);

export function kybReviewMarket(
  item: Pick<OrgKybReview, 'countryCode' | 'regulator' | 'regulatorName'>,
): KybReviewMarket {
  const countryCode = text(item.countryCode)?.toUpperCase() ?? null;
  const market: Market | null = marketOrNull(countryCode);
  // null is the server's answer ("no supported market, no regulator"); undefined is an older
  // server that did not send the field.
  const serverSentRegulator = item.regulator !== undefined;
  return {
    known: market !== null,
    countryCode,
    countryName: market?.countryName ?? countryCode,
    regulator: serverSentRegulator ? text(item.regulator) : (market?.regulator ?? null),
    regulatorName: text(item.regulatorName),
    level1Label: market ? MARKETS[market.countryCode].adminDivisionLabels.level1 : UNKNOWN_MARKET_LEVEL1,
  };
}
