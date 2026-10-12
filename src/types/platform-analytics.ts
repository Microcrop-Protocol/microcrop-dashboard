/**
 * PLATFORM ANALYTICS — the view models the platform analytics pages render.
 *
 * Built by the normalisers in lib/platform-analytics.ts from the `/dashboard/platform/analytics/*`
 * responses. The pages never read the wire shape directly: the old pages declared shapes the
 * backend never sent (`totalFees`, `avgWeatherScore`, `byCounty` as `{name, value}`), so every
 * figure silently read `undefined ?? 0`.
 *
 * THE CURRENCY RULE these types encode:
 *
 *   - Local money (premiums, fees) is only ever present for ONE market at a time, and carries the
 *     `countryCode`/`currency` the SERVER echoed. A page labels it only when that echo matches
 *     the market it asked for — see `confirmedMarket`.
 *   - Payout money is USDC in every market (payouts settle on-chain) and lives only in fields
 *     ending `Usdc`. It is never added to, plotted on the same axis as, or divided by local money.
 *   - A loss ratio is whatever the server computed on a single USDC basis, or null. The dashboard
 *     never derives one from a local premium and a USDC payout.
 */
import type { Granularity } from './index';

/** Query every platform analytics endpoint accepts. Dates are ISO-8601. */
export interface PlatformAnalyticsQuery {
  countryCode?: string;
  startDate?: string;
  endDate?: string;
  granularity?: Granularity;
}

export interface NamedCount {
  name: string;
  value: number;
}

/** The market a money response is denominated in, as the server stated it. */
export interface AnalyticsMarketEcho {
  /** null when the server did not echo one (all markets, or an older backend). */
  countryCode: string | null;
  currency: string | null;
}

export interface RevenueAnalyticsView extends AnalyticsMarketEcho {
  granularity: Granularity;
  totals: {
    /** In `currency`. */
    premiums: number;
    /** In `currency`. */
    fees: number;
    payoutsUsdc: number;
    /** Server-computed on a USDC basis, else null. Never derived client-side. */
    lossRatio: number | null;
  };
  timeSeries: { date: string; premiums: number; fees: number; payoutsUsdc: number }[];
  byOrganization: {
    organizationId: string;
    name: string;
    /** In `currency`. */
    fees: number;
    /** In `currency`. */
    premiums: number;
    count: number;
  }[];
}

export interface PoliciesAnalyticsView extends AnalyticsMarketEcho {
  granularity: Granularity;
  totalPolicies: number;
  activePolicies: number;
  claimsRatio: number;
  newInPeriod: number;
  timeSeries: { date: string; value: number }[];
  byStatus: NamedCount[];
  byCoverage: NamedCount[];
}

export interface FarmersByCounty {
  /** null only on a legacy response that did not say which market the county is in. */
  countryCode: string | null;
  /** The `county` column — a County in Kenya, a Region in Ghana. */
  county: string;
  count: number;
}

export interface FarmersAnalyticsView extends AnalyticsMarketEcho {
  granularity: Granularity;
  totalFarmers: number;
  /** Farmers whose KYC is APPROVED — the numerator of the approval rate. */
  kycApproved: number;
  newInPeriod: number;
  timeSeries: { date: string; value: number }[];
  byKycStatus: NamedCount[];
  byCounty: FarmersByCounty[];
}

export interface PayoutsAnalyticsView extends AnalyticsMarketEcho {
  granularity: Granularity;
  totalUsdc: number;
  avgUsdc: number;
  count: number;
  successRate: number;
  timeSeries: { date: string; amountUsdc: number; count: number }[];
  byStatus: NamedCount[];
  /** Settlement determinations grouped by status, e.g. { CONFIRMED: 12, UNDERFUNDED: 3 }. */
  byDeterminationStatus?: Record<string, number>;
}

export interface DamageAssessmentRow {
  id: string;
  policyNumber: string;
  weatherDamage: number;
  satelliteDamage: number;
  combinedDamage: number;
  triggered: boolean;
  triggerDate: string | null;
}

export interface DamageAnalyticsView extends AnalyticsMarketEcho {
  avgWeather: number;
  avgSatellite: number;
  avgCombined: number;
  triggerRate: number;
  total: number;
  assessments: DamageAssessmentRow[];
}
