/**
 * PLATFORM ANALYTICS — turning `/dashboard/platform/*` responses into figures that are safe to
 * label, and the USDC formatting the payout figures need.
 *
 * WHY THE NORMALISERS EXIST. The platform pages used to read field names the backend never sent
 * (`totalOrganizations`, `premiumsCollected`, `avgWeatherScore`, `byCounty` as `{name, value}`)
 * and formatted every amount with a hardcoded `currency: 'KES'`. Production showed zeros, and the
 * one figure that did arrive — payouts, which are USDC — was labelled Kenyan shillings. These
 * functions are the one place the wire shape is read; the pages render the view models in
 * types/platform-analytics.ts.
 *
 * WHAT THEY REFUSE TO DO:
 *
 *   - Label local money with a currency the server did not confirm. `confirmedMarket` returns a
 *     Market only when the response echoes the market that was asked for AND that market's
 *     currency matches the mirror. An older backend that ignores `?countryCode=` answers with
 *     every market mixed together and no echo; those figures render with no currency token, which
 *     is incomplete, rather than as KES, which would be false.
 *   - Treat a payout amount as anything but USDC, or read one from a field that does not say so.
 *     Payout money is taken ONLY from fields ending `Usdc`.
 *   - Compute a loss ratio. A local premium over a USDC payout is not a ratio of anything. The
 *     server computes it on a USDC basis or sends null, and null is rendered as "—".
 */
import { endOfDay, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { marketOrNull, type Market } from './market';
import type {
  DamageAnalyticsView,
  FarmersAnalyticsView,
  FarmersByCounty,
  Granularity,
  NamedCount,
  PayoutsAnalyticsView,
  PlatformCurrencyFinancials,
  PlatformStats,
  PoliciesAnalyticsView,
  RevenueAnalyticsView,
} from '@/types';

/** Payouts settle on-chain in USDC in every market. Not an ISO 4217 code, so Intl cannot format it. */
export const USDC = 'USDC';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const rec = (v: unknown): Rec => (isRec(v) ? v : {});

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Prisma Decimals arrive as strings; analytics figures must be numbers. Non-numeric → 0. */
const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/** A number when one is actually present, else undefined — so a caller can tell 0 from absent. */
const maybeNum = (v: unknown): number | undefined =>
  v === null || v === undefined || v === '' ? undefined : num(v);

const nullableRatio = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

const GRANULARITIES: readonly Granularity[] = ['daily', 'weekly', 'monthly'];
const granularityOf = (v: unknown): Granularity =>
  GRANULARITIES.includes(v as Granularity) ? (v as Granularity) : 'daily';

/** Chart x-axis value: the calendar date of an ISO timestamp, or the string as sent. */
const dateKey = (v: unknown): string => {
  const s = typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : String(v ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
};

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

/** ACTIVE → Active, PENDING_REVIEW → Pending review. */
export function humanizeEnum(value: string): string {
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * A `{ KEY: count }` map (groupByToMap) or an already-shaped `[{ name, value }]` array, as named
 * counts. The raw keys are kept by the callers that need to look one up.
 */
function namedCounts(v: unknown): NamedCount[] {
  if (Array.isArray(v)) {
    return v
      .map((row) => rec(row))
      .map((row) => ({ name: String(row.name ?? row.status ?? ''), value: num(row.value ?? row.count) }))
      .filter((row) => row.name !== '');
  }
  return Object.entries(rec(v)).map(([key, value]) => ({
    name: humanizeEnum(key),
    // byStatus on payouts is { STATUS: { count, amountUsdc } }.
    value: isRec(value) ? num(value.count) : num(value),
  }));
}

function countFor(v: unknown, key: string): number | undefined {
  if (Array.isArray(v)) {
    const hit = v.map(rec).find((row) => row.name === key || row.name === humanizeEnum(key));
    return hit ? num(hit.value ?? hit.count) : undefined;
  }
  const raw = rec(v)[key];
  if (raw === undefined) return undefined;
  return isRec(raw) ? num(raw.count) : num(raw);
}

// ---------------------------------------------------------------------------
// MARKET CONFIRMATION
// ---------------------------------------------------------------------------

/**
 * The market whose currency may be printed on a response's local money, or null.
 *
 * Non-null only when the server named a market and a currency, the market is one we know, its
 * currency is the one the server named, and — when a market was asked for — it is THAT market.
 * The last condition is what catches a backend that silently ignored `?countryCode=`.
 */
export function confirmedMarket(
  echo: { countryCode?: string | null; currency?: string | null },
  requestedCountryCode?: string,
): Market | null {
  const countryCode = str(echo.countryCode);
  const currency = str(echo.currency);
  if (!countryCode || !currency) return null;
  if (requestedCountryCode && countryCode.toUpperCase() !== requestedCountryCode.toUpperCase()) return null;
  const market = marketOrNull(countryCode);
  if (!market || market.currency !== currency.toUpperCase()) return null;
  return market;
}

// ---------------------------------------------------------------------------
// FORMATTING
// ---------------------------------------------------------------------------

/** "USDC 1,234.56". Payout amounts are always USDC, so this never needs a market. */
export function formatUsdc(value: number | string | null | undefined, decimals = 2): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `${USDC} —`;
  return `${USDC} ${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** "USDC 1.2K", for a stat tile or an axis. */
export function formatUsdcCompact(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return `${USDC} —`;
  return `${USDC} ${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)}`;
}

/** A 0..1 ratio as a percentage, or "—" when there is no ratio to show. */
export function formatRatio(value: number | null | undefined, decimals = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : `${(value * 100).toFixed(decimals)}%`;
}

/** The default analytics window: the last 30 days, ending now. */
export function defaultAnalyticsRange(now: Date = new Date()): DateRange {
  return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
}

/**
 * The `startDate`/`endDate` pair for a picked range, whole days inclusive. The backend requires
 * both or neither; a range with only a start (mid-selection) is that one day.
 */
export function dateRangeParams(range: DateRange | undefined): { startDate?: string; endDate?: string } {
  if (!range?.from) return {};
  const to = range.to ?? range.from;
  return {
    startDate: startOfDay(range.from).toISOString(),
    endDate: endOfDay(to).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// NORMALISERS
// ---------------------------------------------------------------------------

export function normalizePlatformStats(raw: unknown): PlatformStats {
  const r = rec(raw);
  const orgs = rec(r.organizations);
  const policies = rec(r.policies);
  const farmers = rec(r.farmers);
  const fin = rec(r.financials);
  const period = rec(r.period);

  const byCurrency: PlatformCurrencyFinancials[] = arr(fin.byCurrency)
    .map(rec)
    .map((row) => ({
      countryCode: str(row.countryCode) ?? '',
      currency: str(row.currency) ?? '',
      totalPremiums: num(row.totalPremiums),
      totalFees: num(row.totalFees),
    }))
    // A row that does not say which market and currency it is cannot be labelled — and an
    // unlabelled per-currency tile is meaningless — so it is dropped rather than shown as a guess.
    .filter((row) => row.countryCode !== '' && row.currency !== '');

  return {
    organizations: { total: num(orgs.total), active: num(orgs.active), inactive: num(orgs.inactive) },
    policies: { total: num(policies.total), active: num(policies.active), periodNew: num(policies.periodNew) },
    farmers: { total: num(farmers.total) },
    financials: {
      byCurrency,
      totalPayoutsUsdc: num(fin.totalPayoutsUsdc),
      totalPayoutCount: num(fin.totalPayoutCount),
    },
    period: { start: str(period.start), end: str(period.end) },
  };
}

export function normalizeRevenueAnalytics(raw: unknown): RevenueAnalyticsView {
  const r = rec(raw);
  const timeSeries = arr(r.timeSeries).map(rec).map((row) => ({
    date: dateKey(row.date),
    premiums: num(row.totalPremiums ?? row.premiums),
    fees: num(row.totalFees ?? row.fees),
    payoutsUsdc: num(row.totalPayoutsUsdc ?? row.payoutsUsdc),
  }));

  const totals = rec(r.totals ?? r.summary);
  const premiums = maybeNum(totals.totalPremiums) ?? sum(timeSeries.map((p) => p.premiums));
  const fees = maybeNum(totals.totalFees) ?? sum(timeSeries.map((p) => p.fees));
  const payoutsUsdc = maybeNum(totals.totalPayoutsUsdc) ?? sum(timeSeries.map((p) => p.payoutsUsdc));

  return {
    countryCode: str(r.countryCode),
    currency: str(r.currency),
    granularity: granularityOf(r.granularity),
    totals: {
      premiums,
      fees,
      payoutsUsdc,
      lossRatio: nullableRatio(totals.lossRatio ?? r.lossRatio),
    },
    timeSeries,
    byOrganization: arr(r.byOrganization).map(rec).map((row) => ({
      organizationId: String(row.organizationId ?? ''),
      name: str(row.organizationName) ?? str(row.name) ?? 'Unknown organization',
      fees: num(row.totalFees),
      premiums: num(row.totalPremiums),
      count: num(row.count),
    })),
  };
}

export function normalizePoliciesAnalytics(raw: unknown): PoliciesAnalyticsView {
  const r = rec(raw);
  const timeSeries = arr(r.timeSeries).map(rec).map((row) => ({
    date: dateKey(row.date),
    value: num(row.totalPolicies ?? row.value ?? row.count),
  }));
  const byStatus = namedCounts(r.byStatus);

  return {
    countryCode: str(r.countryCode),
    currency: str(r.currency),
    granularity: granularityOf(r.granularity),
    totalPolicies: maybeNum(r.totalPolicies) ?? sum(byStatus.map((s) => s.value)),
    activePolicies: maybeNum(r.activePolicies) ?? countFor(r.byStatus, 'ACTIVE') ?? 0,
    claimsRatio: num(r.claimsRatio),
    newInPeriod: sum(timeSeries.map((p) => p.value)),
    timeSeries,
    byStatus,
    byCoverage: namedCounts(r.byCoverage),
  };
}

function farmersByCounty(v: unknown): FarmersByCounty[] {
  const rows: FarmersByCounty[] = Array.isArray(v)
    ? v.map(rec).map((row) => ({
        countryCode: str(row.countryCode),
        county: str(row.county) ?? 'Not recorded',
        count: num(row.count),
      }))
    : // Legacy `{ county: count }` map: no market on the row, so none is claimed.
      Object.entries(rec(v)).map(([county, count]) => ({
        countryCode: null,
        county: county === 'null' || county === '' ? 'Not recorded' : county,
        count: num(count),
      }));
  return rows.sort((a, b) => b.count - a.count);
}

export function normalizeFarmersAnalytics(raw: unknown): FarmersAnalyticsView {
  const r = rec(raw);
  const timeSeries = arr(r.growthTimeSeries ?? r.timeSeries).map(rec).map((row) => ({
    date: dateKey(row.date),
    value: num(row.farmersRegistered ?? row.value),
  }));

  return {
    countryCode: str(r.countryCode),
    currency: str(r.currency),
    granularity: granularityOf(r.granularity),
    totalFarmers: num(r.total ?? r.totalFarmers),
    kycApproved: countFor(r.byKycStatus, 'APPROVED') ?? 0,
    newInPeriod: sum(timeSeries.map((p) => p.value)),
    timeSeries,
    byKycStatus: namedCounts(r.byKycStatus),
    byCounty: farmersByCounty(r.byCounty),
  };
}

/** KYC approval rate, or null when there are no farmers to have a rate over. */
export function kycApprovalRate(view: Pick<FarmersAnalyticsView, 'kycApproved' | 'totalFarmers'>): number | null {
  return view.totalFarmers > 0 ? view.kycApproved / view.totalFarmers : null;
}

export function normalizePayoutsAnalytics(raw: unknown): PayoutsAnalyticsView {
  const r = rec(raw);
  const summary = rec(r.summary);
  const timeSeries = arr(r.timeSeries).map(rec).map((row) => ({
    date: dateKey(row.date),
    amountUsdc: num(row.totalPayoutsUsdc ?? row.amountUsdc),
    count: num(row.totalPayoutsCount ?? row.count),
  }));
  const determination = r.byDeterminationStatus;

  return {
    countryCode: str(r.countryCode),
    currency: str(r.currency),
    granularity: granularityOf(r.granularity),
    totalUsdc: num(summary.totalAmountUsdc ?? summary.totalPayoutsUsdc),
    avgUsdc: num(summary.avgAmountUsdc),
    count: num(summary.totalCount ?? summary.count),
    successRate: num(r.successRate),
    timeSeries,
    byStatus: namedCounts(r.byStatus),
    byDeterminationStatus: isRec(determination)
      ? Object.fromEntries(Object.entries(determination).map(([k, v]) => [k, num(v)]))
      : undefined,
  };
}

export function normalizeDamageAnalytics(raw: unknown): DamageAnalyticsView {
  const r = rec(raw);
  const summary = rec(r.summary);
  return {
    countryCode: str(r.countryCode),
    currency: str(r.currency),
    avgWeather: num(summary.avgWeather),
    avgSatellite: num(summary.avgSatellite),
    avgCombined: num(summary.avgCombined),
    triggerRate: num(summary.triggerRate),
    total: num(r.total ?? summary.total),
    assessments: arr(r.data ?? r.assessments).map(rec).map((row) => ({
      id: String(row.id ?? ''),
      policyNumber: str(row.policyNumber) ?? str(rec(row.policy).policyNumber) ?? '—',
      weatherDamage: num(row.weatherDamage),
      satelliteDamage: num(row.satelliteDamage),
      combinedDamage: num(row.combinedDamage),
      triggered: row.triggered === true,
      triggerDate: str(row.triggerDate) ?? str(row.createdAt),
    })),
  };
}

/**
 * Bars for the farmers-by-county chart. Across markets each bar names its market — "Northern"
 * is a Ghanaian Region and could as easily be a place name elsewhere — and within one market the
 * market is the page's own filter, so it is left off. Capped to the largest `limit` areas.
 */
export function countyChartData(
  rows: FarmersByCounty[],
  { withMarket, limit = 15 }: { withMarket: boolean; limit?: number },
): NamedCount[] {
  return rows.slice(0, limit).map((row) => ({
    name: withMarket && row.countryCode ? `${row.county} (${row.countryCode})` : row.county,
    value: row.count,
  }));
}
