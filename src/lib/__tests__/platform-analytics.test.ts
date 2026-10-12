/**
 * PLATFORM ANALYTICS NORMALISERS — the one place the `/dashboard/platform/*` wire shape is read.
 *
 * What this file pins, in the order the risks matter:
 *
 *   1. LOCAL MONEY IS LABELLED ONLY WHEN THE SERVER CONFIRMS ITS MARKET. A response that does not
 *      echo the market that was asked for (an older backend ignoring `?countryCode=` returns every
 *      market summed) must come out with NO currency, never KES.
 *   2. PAYOUT MONEY IS USDC AND IS READ ONLY FROM `…Usdc` FIELDS. A bare `amountUSDC` or
 *      `totalPayoutsAmount` is not taken as a payout figure; the contract names payout fields
 *      with the Usdc suffix, and anything else might be local money.
 *   3. A LOSS RATIO IS NEVER DERIVED CLIENT-SIDE. Null from the server stays null.
 *   4. THE OVERVIEW IS NESTED. The old flat `totalOrganizations`/`premiumsCollected` shape was
 *      never sent; the normaliser reads `organizations.total`, `financials.byCurrency`, ….
 */
import { describe, it, expect } from 'vitest';
import {
  confirmedMarket,
  countyChartData,
  dateRangeParams,
  defaultAnalyticsRange,
  formatRatio,
  formatUsdc,
  formatUsdcCompact,
  humanizeEnum,
  kycApprovalRate,
  normalizeDamageAnalytics,
  normalizeFarmersAnalytics,
  normalizePayoutsAnalytics,
  normalizePlatformStats,
  normalizePoliciesAnalytics,
  normalizeRevenueAnalytics,
} from '@/lib/platform-analytics';
import { MARKETS } from '@/lib/market';

describe('confirmedMarket — the gate on printing a currency', () => {
  it('confirms a market the server echoed with its own currency', () => {
    expect(confirmedMarket({ countryCode: 'GH', currency: 'GHS' }, 'GH')).toBe(MARKETS.GH);
    expect(confirmedMarket({ countryCode: 'ke', currency: 'kes' }, 'KE')).toBe(MARKETS.KE);
  });

  it('refuses when the server answered for a different market than was asked for', () => {
    expect(confirmedMarket({ countryCode: 'KE', currency: 'KES' }, 'GH')).toBeNull();
  });

  it('refuses when the server echoed nothing — the old backend that ignores ?countryCode=', () => {
    expect(confirmedMarket({}, 'GH')).toBeNull();
    expect(confirmedMarket({ countryCode: null, currency: null }, 'KE')).toBeNull();
  });

  it('refuses a currency that is not the market currency', () => {
    expect(confirmedMarket({ countryCode: 'GH', currency: 'KES' }, 'GH')).toBeNull();
  });

  it('refuses a market this build does not know', () => {
    expect(confirmedMarket({ countryCode: 'UG', currency: 'UGX' })).toBeNull();
  });

  it('confirms a per-currency row on its own when no market was asked for', () => {
    expect(confirmedMarket({ countryCode: 'GH', currency: 'GHS' })).toBe(MARKETS.GH);
  });
});

describe('USDC formatting', () => {
  it('names USDC and never a local currency', () => {
    expect(formatUsdc(1234.5)).toBe('USDC 1,234.50');
    expect(formatUsdcCompact(12500)).toBe('USDC 12.5K');
    expect(formatUsdcCompact('3000000')).toBe('USDC 3M');
    expect(formatUsdcCompact(1000)).not.toMatch(/KES|GHS/);
  });

  it('renders a non-number as a dash rather than NaN', () => {
    expect(formatUsdc('abc')).toBe('USDC —');
    expect(formatUsdcCompact(Number.NaN)).toBe('USDC —');
  });
});

describe('formatRatio', () => {
  it('formats a 0..1 ratio as a percentage', () => {
    expect(formatRatio(0.1234)).toBe('12.3%');
    expect(formatRatio(0.5, 0)).toBe('50%');
  });

  it('renders null as a dash, not 0%', () => {
    expect(formatRatio(null)).toBe('—');
    expect(formatRatio(undefined)).toBe('—');
  });
});

describe('dateRangeParams — the picked range reaches the server', () => {
  it('sends whole days, start of the first to end of the last', () => {
    const params = dateRangeParams({ from: new Date(2026, 8, 1, 15), to: new Date(2026, 8, 30, 9) });
    expect(new Date(params.startDate!).getHours()).toBe(0);
    expect(new Date(params.startDate!).getDate()).toBe(1);
    expect(new Date(params.endDate!).getHours()).toBe(23);
    expect(new Date(params.endDate!).getDate()).toBe(30);
  });

  it('treats a half-picked range as that one day — the backend requires both ends', () => {
    const params = dateRangeParams({ from: new Date(2026, 8, 5, 12), to: undefined });
    expect(params.startDate).toBeDefined();
    expect(new Date(params.endDate!).getDate()).toBe(5);
  });

  it('sends nothing when no range is picked', () => {
    expect(dateRangeParams(undefined)).toEqual({});
  });

  it('defaults to the last 30 days', () => {
    const now = new Date('2026-10-12T00:00:00Z');
    const range = defaultAnalyticsRange(now);
    expect(range.to).toBe(now);
    expect(now.getTime() - range.from!.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe('normalizePlatformStats — the nested overview shape', () => {
  const RAW = {
    organizations: { total: 12, active: 10, inactive: 2 },
    policies: { total: 400, active: 250, periodNew: 31 },
    farmers: { total: 900 },
    financials: {
      // The legacy mixed-currency totals the backend still sends. They must not survive.
      totalPremiums: '999999',
      totalRevenue: '88888',
      totalPayouts: '7777',
      totalPayoutCount: 14,
      totalPayoutsUsdc: '5120.75',
      byCurrency: [
        { countryCode: 'KE', currency: 'KES', totalPremiums: '150000.00', totalFees: '7500.00' },
        { countryCode: 'GH', currency: 'GHS', totalPremiums: 4200, totalFees: 210 },
        { countryCode: null, currency: 'XXX', totalPremiums: 1, totalFees: 1 },
      ],
    },
    period: { start: '2026-09-12T00:00:00.000Z', end: '2026-10-12T00:00:00.000Z' },
  };

  it('reads the nested counts the backend actually sends', () => {
    const stats = normalizePlatformStats(RAW);
    expect(stats.organizations).toEqual({ total: 12, active: 10, inactive: 2 });
    expect(stats.policies).toEqual({ total: 400, active: 250, periodNew: 31 });
    expect(stats.farmers.total).toBe(900);
  });

  it('keeps money per currency, as numbers, and drops a row that cannot be labelled', () => {
    const stats = normalizePlatformStats(RAW);
    expect(stats.financials.byCurrency).toEqual([
      { countryCode: 'KE', currency: 'KES', totalPremiums: 150000, totalFees: 7500 },
      { countryCode: 'GH', currency: 'GHS', totalPremiums: 4200, totalFees: 210 },
    ]);
  });

  it('reports payouts in USDC and carries no mixed-currency total', () => {
    const stats = normalizePlatformStats(RAW);
    expect(stats.financials.totalPayoutsUsdc).toBe(5120.75);
    expect(stats.financials.totalPayoutCount).toBe(14);
    expect(stats.financials).not.toHaveProperty('totalPremiums');
    expect(stats.financials).not.toHaveProperty('totalRevenue');
    expect(stats.financials).not.toHaveProperty('totalPayouts');
  });

  it('tolerates an empty or missing payload without throwing', () => {
    const stats = normalizePlatformStats(undefined);
    expect(stats.organizations.total).toBe(0);
    expect(stats.financials.byCurrency).toEqual([]);
    expect(stats.period).toEqual({ start: null, end: null });
  });
});

describe('normalizeRevenueAnalytics', () => {
  it('reads totals, the echo and the series, with Decimal strings as numbers', () => {
    const view = normalizeRevenueAnalytics({
      countryCode: 'GH',
      currency: 'GHS',
      granularity: 'weekly',
      totals: { totalPremiums: '4200.50', totalFees: '210', totalPayoutsUsdc: '300', lossRatio: 0.42 },
      timeSeries: [{ date: '2026-10-01T00:00:00.000Z', totalPremiums: '100', totalFees: '5', totalPayoutsUsdc: '7' }],
      byOrganization: [{ organizationId: 'o1', organizationName: 'Accra Coop', totalFees: '50', totalPremiums: '1000', count: 3 }],
    });
    expect(view.countryCode).toBe('GH');
    expect(view.currency).toBe('GHS');
    expect(view.granularity).toBe('weekly');
    expect(view.totals).toEqual({ premiums: 4200.5, fees: 210, payoutsUsdc: 300, lossRatio: 0.42 });
    expect(view.timeSeries).toEqual([{ date: '2026-10-01', premiums: 100, fees: 5, payoutsUsdc: 7 }]);
    expect(view.byOrganization).toEqual([
      { organizationId: 'o1', name: 'Accra Coop', fees: 50, premiums: 1000, count: 3 },
    ]);
  });

  it('sums the single-market series when the server sends no totals block', () => {
    const view = normalizeRevenueAnalytics({
      timeSeries: [
        { date: '2026-10-01', totalPremiums: 100, totalFees: 5, totalPayoutsUsdc: 1 },
        { date: '2026-10-02', totalPremiums: 50, totalFees: 2.5, totalPayoutsUsdc: 2 },
      ],
    });
    expect(view.totals).toEqual({ premiums: 150, fees: 7.5, payoutsUsdc: 3, lossRatio: null });
  });

  it('does not take a payout figure from a field that does not say USDC', () => {
    const view = normalizeRevenueAnalytics({
      timeSeries: [{ date: '2026-10-01', totalPremiums: 100, totalFees: 5, totalPayoutsAmount: 999 }],
    });
    expect(view.totals.payoutsUsdc).toBe(0);
    expect(view.timeSeries[0].payoutsUsdc).toBe(0);
  });

  it('keeps a null loss ratio null — it is never computed from local premiums', () => {
    const view = normalizeRevenueAnalytics({
      totals: { totalPremiums: 1000, totalFees: 50, totalPayoutsUsdc: 400, lossRatio: null },
    });
    expect(view.totals.lossRatio).toBeNull();
  });

  it('reports no echo when the server sent none', () => {
    const view = normalizeRevenueAnalytics({ timeSeries: [] });
    expect(view.countryCode).toBeNull();
    expect(view.currency).toBeNull();
    expect(view.granularity).toBe('daily');
  });
});

describe('normalizePoliciesAnalytics', () => {
  it('turns the groupBy maps into named counts and derives totals from them', () => {
    const view = normalizePoliciesAnalytics({
      timeSeries: [
        { date: '2026-10-01', totalPolicies: 4 },
        { date: '2026-10-02', totalPolicies: 6 },
      ],
      byStatus: { ACTIVE: 7, EXPIRED: 2, CLAIMED: 1 },
      byCoverage: { DROUGHT: 9, FLOOD: 1 },
      claimsRatio: 0.1,
      granularity: 'daily',
    });
    expect(view.totalPolicies).toBe(10);
    expect(view.activePolicies).toBe(7);
    expect(view.newInPeriod).toBe(10);
    expect(view.claimsRatio).toBe(0.1);
    expect(view.byStatus).toEqual([
      { name: 'Active', value: 7 },
      { name: 'Expired', value: 2 },
      { name: 'Claimed', value: 1 },
    ]);
    expect(view.byCoverage).toEqual([
      { name: 'Drought', value: 9 },
      { name: 'Flood', value: 1 },
    ]);
  });
});

describe('normalizeFarmersAnalytics — byCounty is an array tagged with its market', () => {
  const RAW = {
    total: 50,
    byKycStatus: { APPROVED: 40, PENDING: 10 },
    byCounty: [
      { countryCode: 'GH', county: 'Northern', count: 5 },
      { countryCode: 'KE', county: 'Nakuru', count: 30 },
      { countryCode: 'KE', county: null, count: 2 },
    ],
    growthTimeSeries: [
      { date: '2026-10-01', farmersRegistered: 3 },
      { date: '2026-10-02', farmersRegistered: 4 },
    ],
  };

  it('keeps each area with its country, largest first', () => {
    const view = normalizeFarmersAnalytics(RAW);
    expect(view.byCounty).toEqual([
      { countryCode: 'KE', county: 'Nakuru', count: 30 },
      { countryCode: 'GH', county: 'Northern', count: 5 },
      { countryCode: 'KE', county: 'Not recorded', count: 2 },
    ]);
  });

  it('reads totals, approvals and the growth series', () => {
    const view = normalizeFarmersAnalytics(RAW);
    expect(view.totalFarmers).toBe(50);
    expect(view.kycApproved).toBe(40);
    expect(view.newInPeriod).toBe(7);
    expect(view.timeSeries).toEqual([
      { date: '2026-10-01', value: 3 },
      { date: '2026-10-02', value: 4 },
    ]);
    expect(kycApprovalRate(view)).toBe(0.8);
  });

  it('claims no market for a legacy { county: count } map', () => {
    const view = normalizeFarmersAnalytics({ byCounty: { Nakuru: 3, Kiambu: 1 } });
    expect(view.byCounty.every((row) => row.countryCode === null)).toBe(true);
  });

  it('has no approval rate when there are no farmers, rather than dividing by a fake 1', () => {
    expect(kycApprovalRate({ kycApproved: 0, totalFarmers: 0 })).toBeNull();
  });
});

describe('countyChartData', () => {
  const rows = [
    { countryCode: 'KE', county: 'Nakuru', count: 30 },
    { countryCode: 'GH', county: 'Northern', count: 5 },
  ];

  it('names the market on each bar across markets', () => {
    expect(countyChartData(rows, { withMarket: true })).toEqual([
      { name: 'Nakuru (KE)', value: 30 },
      { name: 'Northern (GH)', value: 5 },
    ]);
  });

  it('leaves the market off within one market, and caps the bar count', () => {
    expect(countyChartData(rows, { withMarket: false, limit: 1 })).toEqual([{ name: 'Nakuru', value: 30 }]);
  });
});

describe('normalizePayoutsAnalytics — every amount is USDC', () => {
  it('reads the Usdc fields and the per-status counts', () => {
    const view = normalizePayoutsAnalytics({
      countryCode: 'KE',
      currency: 'KES',
      summary: { totalAmountUsdc: '1500.5', avgAmountUsdc: '75.025', totalCount: 20 },
      byStatus: { COMPLETED: { count: 18, amountUsdc: 1400 }, FAILED: { count: 2, amountUsdc: 100.5 } },
      byDeterminationStatus: { CONFIRMED: '12', UNDERFUNDED: 3 },
      successRate: 0.9,
      timeSeries: [{ date: '2026-10-01', totalPayoutsUsdc: '50', totalPayoutsCount: 2 }],
    });
    expect(view.totalUsdc).toBe(1500.5);
    expect(view.avgUsdc).toBe(75.025);
    expect(view.count).toBe(20);
    expect(view.successRate).toBe(0.9);
    expect(view.byStatus).toEqual([
      { name: 'Completed', value: 18 },
      { name: 'Failed', value: 2 },
    ]);
    expect(view.byDeterminationStatus).toEqual({ CONFIRMED: 12, UNDERFUNDED: 3 });
    expect(view.timeSeries).toEqual([{ date: '2026-10-01', amountUsdc: 50, count: 2 }]);
  });

  it('ignores an amount field that does not carry the Usdc suffix', () => {
    const view = normalizePayoutsAnalytics({ summary: { totalAmount: 999, avgAmount: 9 } });
    expect(view.totalUsdc).toBe(0);
    expect(view.avgUsdc).toBe(0);
  });
});

describe('normalizeDamageAnalytics', () => {
  it('reads the summary block and the policy number from the included relation', () => {
    const view = normalizeDamageAnalytics({
      summary: { avgWeather: '0.4', avgSatellite: 0.3, avgCombined: 0.35, total: 2, triggered: 1, triggerRate: 0.5 },
      data: [
        {
          id: 'a1',
          weatherDamage: '0.4',
          satelliteDamage: '0.3',
          combinedDamage: '0.35',
          triggered: true,
          triggerDate: '2026-10-01T00:00:00Z',
          policy: { policyNumber: 'POL-1' },
        },
      ],
      total: 2,
    });
    expect(view.avgWeather).toBe(0.4);
    expect(view.triggerRate).toBe(0.5);
    expect(view.total).toBe(2);
    expect(view.assessments[0]).toEqual({
      id: 'a1',
      policyNumber: 'POL-1',
      weatherDamage: 0.4,
      satelliteDamage: 0.3,
      combinedDamage: 0.35,
      triggered: true,
      triggerDate: '2026-10-01T00:00:00Z',
    });
  });
});

describe('humanizeEnum', () => {
  it('turns an enum into words', () => {
    expect(humanizeEnum('PENDING_REVIEW')).toBe('Pending review');
    expect(humanizeEnum('ACTIVE')).toBe('Active');
  });
});
