/**
 * KYB REVIEW — which market an organization under review belongs to, for the platform reviewer.
 *
 * The market decides which regulator must have licensed the organization (IRA in Kenya, NIC in
 * Ghana) and which documents its checklist requires. A reviewer approving a Ghanaian insurer
 * against Kenya's regulator is approving the wrong thing, so the country is shown on every review
 * card and an organization with no recognised market is shown as UNKNOWN, never as Kenya.
 *
 * The regulator the server names on the review item wins; the dashboard's market mirror is only
 * used when an older backend did not send one. The required-document LIST is never mirrored: it
 * comes from `GET /platform/organizations/:orgId/kyb` → `checklist`, built server-side.
 */
import { marketOrNull } from './market';
import type { OrgKybReview } from '@/types';

export interface KybReviewMarket {
  /** True when the organization's country is a market this build recognises. */
  known: boolean;
  countryCode: string | null;
  /** "Ghana"; the raw code for an unrecognised market; null when the org has none. */
  countryName: string | null;
  /** "NIC"; null when neither the server nor a recognised market names one. */
  regulator: string | null;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export function kybReviewMarket(item: Pick<OrgKybReview, 'countryCode' | 'regulator'>): KybReviewMarket {
  const countryCode = text(item.countryCode)?.toUpperCase() ?? null;
  const market = marketOrNull(countryCode);
  return {
    known: market !== null,
    countryCode,
    countryName: market?.countryName ?? countryCode,
    regulator: text(item.regulator) ?? market?.regulator ?? null,
  };
}
