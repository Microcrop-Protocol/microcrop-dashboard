/**
 * PLATFORM ANALYTICS PAGES AND THE MARKET.
 *
 *   1. LOCAL-MONEY PAGES ARE SINGLE-MARKET. Revenue never offers "All markets", defaults to the
 *      first registry market, and SAYS which market it is showing. Payouts are USDC in every
 *      market, so the payouts page DOES offer — and default to — the platform-wide view.
 *   2. LOCAL MONEY IS LABELLED ONLY WHEN THE SERVER CONFIRMS THE MARKET. A response with no echo,
 *      or echoing a different market than was asked for, renders unlabelled figures and a notice.
 *   3. PAYOUTS ARE USDC on every page that shows them.
 *   4. ABSENT MONEY IS "—", never a confident 0.
 *   5. FARMERS-BY-AREA uses the market's own division label, and names the market on each area
 *      across markets.
 *   6. POLICIES and DAMAGE are counts and ratios: "All markets" by default, one market on request.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  DamageAnalyticsView,
  FarmersAnalyticsView,
  PayoutsAnalyticsView,
  PoliciesAnalyticsView,
  RevenueAnalyticsView,
} from '@/types';
import { MARKETS, SUPPORTED_COUNTRY_CODES } from '@/lib/market';

const mocks = vi.hoisted(() => ({
  getRevenueAnalytics: vi.fn(),
  getPayoutsAnalytics: vi.fn(),
  getFarmersAnalytics: vi.fn(),
  getPoliciesAnalytics: vi.fn(),
  getDamageAnalytics: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getRevenueAnalytics: mocks.getRevenueAnalytics,
    getPayoutsAnalytics: mocks.getPayoutsAnalytics,
    getFarmersAnalytics: mocks.getFarmersAnalytics,
    getPoliciesAnalytics: mocks.getPoliciesAnalytics,
    getDamageAnalytics: mocks.getDamageAnalytics,
  },
}));

import RevenueAnalyticsPage from '../analytics/RevenueAnalyticsPage';
import PayoutsAnalyticsPage from '../analytics/PayoutsAnalyticsPage';
import FarmersAnalyticsPage from '../analytics/FarmersAnalyticsPage';
import PoliciesAnalyticsPage from '../analytics/PoliciesAnalyticsPage';
import DamageAnalyticsPage from '../analytics/DamageAnalyticsPage';

function renderAt(element: React.ReactElement, path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function revenue(overrides: Partial<RevenueAnalyticsView> = {}): RevenueAnalyticsView {
  return {
    countryCode: 'GH',
    currency: 'GHS',
    granularity: 'daily',
    totals: { premiums: 4200, fees: 210, payoutsUsdc: 300, lossRatio: null },
    timeSeries: [],
    byOrganization: [],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getRevenueAnalytics.mockReset();
  mocks.getPayoutsAnalytics.mockReset();
  mocks.getFarmersAnalytics.mockReset();
  mocks.getPoliciesAnalytics.mockReset();
  mocks.getDamageAnalytics.mockReset();
});

describe('RevenueAnalyticsPage', () => {
  it('defaults to the first registry market, shows it, and asks the server for it', async () => {
    mocks.getRevenueAnalytics.mockResolvedValue(revenue({ countryCode: 'KE', currency: 'KES' }));
    renderAt(<RevenueAnalyticsPage />, '/platform/analytics/revenue');

    const first = MARKETS[SUPPORTED_COUNTRY_CODES[0]];
    await waitFor(() => expect(mocks.getRevenueAnalytics).toHaveBeenCalled());
    expect(mocks.getRevenueAnalytics.mock.calls[0][0]).toMatchObject({
      countryCode: first.countryCode,
      granularity: 'daily',
    });
    expect(mocks.getRevenueAnalytics.mock.calls[0][0].startDate).toBeDefined();
    expect(screen.getByRole('combobox', { name: /select market/i })).toHaveTextContent(first.countryName);
  });

  it('does not offer "All markets" — revenue is one currency at a time', async () => {
    mocks.getRevenueAnalytics.mockResolvedValue(revenue());
    renderAt(<RevenueAnalyticsPage />, '/platform/analytics/revenue?market=ALL');
    fireEvent.click(screen.getByRole('combobox', { name: /select market/i }));
    expect(await screen.findByRole('option', { name: 'Ghana (GHS)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'All markets' })).not.toBeInTheDocument();
  });

  it('labels Ghanaian premiums GHS when the server confirms the market', async () => {
    mocks.getRevenueAnalytics.mockResolvedValue(revenue());
    renderAt(<RevenueAnalyticsPage />, '/platform/analytics/revenue?market=GH');
    expect(await screen.findByText('Total Premiums (GHS)')).toBeInTheDocument();
    expect(screen.getByText(/^GHS\s4\.2K$/)).toBeInTheDocument();
    expect(screen.queryByText(/KES/)).not.toBeInTheDocument();
  });

  it('shows the figures unlabelled, with a notice, when the server did not confirm the market', async () => {
    mocks.getRevenueAnalytics.mockResolvedValue(revenue({ countryCode: null, currency: null }));
    renderAt(<RevenueAnalyticsPage />, '/platform/analytics/revenue?market=GH');
    expect(await screen.findByText(/did not confirm that these figures are for Ghana/)).toBeInTheDocument();
    expect(screen.getByText('Total Premiums')).toBeInTheDocument();
    expect(screen.getByText('4.2K')).toBeInTheDocument();
    expect(screen.queryByText(/KES|GHS\s4/)).not.toBeInTheDocument();
  });

  it('refuses to label figures echoed for a DIFFERENT market than the one asked for', async () => {
    // Asked for Ghana; the server answered for Kenya (e.g. it ignored ?countryCode= and fell back
    // to a default). Its echo is internally consistent, so only the requested-market check in
    // confirmedMarket(data, countryCode) catches it.
    mocks.getRevenueAnalytics.mockResolvedValue(revenue({ countryCode: 'KE', currency: 'KES' }));
    renderAt(<RevenueAnalyticsPage />, '/platform/analytics/revenue?market=GH');
    expect(await screen.findByText(/did not confirm that these figures are for Ghana/)).toBeInTheDocument();
    expect(mocks.getRevenueAnalytics.mock.calls[0][0].countryCode).toBe('GH');
    expect(screen.getByText('Total Premiums')).toBeInTheDocument();
    expect(screen.getByText('4.2K')).toBeInTheDocument();
    expect(screen.queryByText(/KES/)).not.toBeInTheDocument();
    expect(screen.queryByText('Total Premiums (GHS)')).not.toBeInTheDocument();
    expect(screen.queryByText(/^GHS\s/)).not.toBeInTheDocument();
  });

  it('shows absent money as a dash, never as a confident zero', async () => {
    mocks.getRevenueAnalytics.mockResolvedValue(
      revenue({ totals: { premiums: null, fees: null, payoutsUsdc: null, lossRatio: null } }),
    );
    renderAt(<RevenueAnalyticsPage />, '/platform/analytics/revenue?market=GH');
    await screen.findByText('Total Premiums (GHS)');
    expect(screen.queryByText(/USDC 0|GHS\s0/)).not.toBeInTheDocument();
    // Premiums, fees, payouts and the loss ratio all read "—".
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('reports payouts in USDC and a missing loss ratio as a dash', async () => {
    mocks.getRevenueAnalytics.mockResolvedValue(revenue());
    renderAt(<RevenueAnalyticsPage />, '/platform/analytics/revenue?market=GH');
    expect(await screen.findByText('USDC 300')).toBeInTheDocument();
    expect(screen.getByText('Needs USDC-denominated premiums')).toBeInTheDocument();
    expect(screen.queryByText(/net revenue/i)).not.toBeInTheDocument();
  });
});

describe('PayoutsAnalyticsPage', () => {
  const payouts = (overrides: Partial<PayoutsAnalyticsView> = {}): PayoutsAnalyticsView => ({
    countryCode: null,
    currency: null,
    granularity: 'daily',
    totalUsdc: 1500,
    avgUsdc: 75,
    count: 20,
    successRate: 0.9,
    timeSeries: [],
    byStatus: [],
    ...overrides,
  });

  it('defaults to the platform-wide view — payouts are USDC in every market', async () => {
    mocks.getPayoutsAnalytics.mockResolvedValue(payouts());
    renderAt(<PayoutsAnalyticsPage />, '/platform/analytics/payouts');
    expect(await screen.findByText('USDC 1.5K')).toBeInTheDocument();
    expect(mocks.getPayoutsAnalytics.mock.calls[0][0].countryCode).toBeUndefined();
    expect(screen.getByRole('combobox', { name: /select market/i })).toHaveTextContent('All markets');
    expect(screen.getByText(/all markets — amounts in USDC/)).toBeInTheDocument();
  });

  it('offers "All markets" and keeps it on reload', async () => {
    mocks.getPayoutsAnalytics.mockResolvedValue(payouts());
    renderAt(<PayoutsAnalyticsPage />, '/platform/analytics/payouts?market=ALL');
    await screen.findByText('USDC 1.5K');
    expect(mocks.getPayoutsAnalytics.mock.calls[0][0].countryCode).toBeUndefined();
    fireEvent.click(screen.getByRole('combobox', { name: /select market/i }));
    expect(await screen.findByRole('option', { name: 'All markets' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ghana (GHS)' })).toBeInTheDocument();
  });

  it('shows absent payout amounts as a dash, not "USDC 0"', async () => {
    mocks.getPayoutsAnalytics.mockResolvedValue(payouts({ totalUsdc: null, avgUsdc: null }));
    renderAt(<PayoutsAnalyticsPage />, '/platform/analytics/payouts');
    await screen.findByText('Total Paid (USDC)');
    await waitFor(() => expect(screen.getByText('20')).toBeInTheDocument());
    expect(screen.queryByText(/USDC 0/)).not.toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('shows every amount in USDC, whatever the market', async () => {
    const view: PayoutsAnalyticsView = {
      countryCode: 'GH',
      currency: 'GHS',
      granularity: 'daily',
      totalUsdc: 1500,
      avgUsdc: 75,
      count: 20,
      successRate: 0.9,
      timeSeries: [],
      byStatus: [],
    };
    mocks.getPayoutsAnalytics.mockResolvedValue(view);
    renderAt(<PayoutsAnalyticsPage />, '/platform/analytics/payouts?market=GH');
    expect(await screen.findByText('USDC 1.5K')).toBeInTheDocument();
    expect(screen.getByText('USDC 75')).toBeInTheDocument();
    expect(screen.getByText('90.0%')).toBeInTheDocument();
    expect(screen.queryByText(/KES|GHS\s/)).not.toBeInTheDocument();
    expect(mocks.getPayoutsAnalytics.mock.calls[0][0].countryCode).toBe('GH');
  });
});

describe('FarmersAnalyticsPage', () => {
  const view: FarmersAnalyticsView = {
    countryCode: null,
    currency: null,
    granularity: 'daily',
    totalFarmers: 50,
    kycApproved: 40,
    newInPeriod: 7,
    timeSeries: [],
    byKycStatus: [],
    byCounty: [
      { countryCode: 'KE', county: 'Nakuru', count: 30 },
      { countryCode: 'GH', county: 'Northern', count: 5 },
    ],
  };

  it('labels areas for every market across markets, and asks for all', async () => {
    mocks.getFarmersAnalytics.mockResolvedValue(view);
    renderAt(<FarmersAnalyticsPage />, '/platform/analytics/farmers');
    expect(await screen.findByText('Counties / Regions Covered')).toBeInTheDocument();
    expect(screen.getByText('Farmers by County / Region')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(mocks.getFarmersAnalytics.mock.calls[0][0].countryCode).toBeUndefined();
  });

  it("uses Ghana's own label when Ghana is selected", async () => {
    mocks.getFarmersAnalytics.mockResolvedValue({ ...view, byCounty: [view.byCounty[1]] });
    renderAt(<FarmersAnalyticsPage />, '/platform/analytics/farmers?market=GH');
    expect(await screen.findByText('Regions Covered')).toBeInTheDocument();
    expect(screen.getByText('Farmers by Region')).toBeInTheDocument();
    expect(mocks.getFarmersAnalytics.mock.calls[0][0].countryCode).toBe('GH');
  });
});

describe('PoliciesAnalyticsPage', () => {
  const view: PoliciesAnalyticsView = {
    countryCode: null,
    currency: null,
    granularity: 'daily',
    totalPolicies: 1234,
    activePolicies: 700,
    claimsRatio: 0.125,
    newInPeriod: 31,
    timeSeries: [],
    byStatus: [{ name: 'Active', value: 700 }],
    byCoverage: [{ name: 'Drought', value: 1234 }],
  };

  it('shows the counts across all markets by default, and asks for all', async () => {
    mocks.getPoliciesAnalytics.mockResolvedValue(view);
    renderAt(<PoliciesAnalyticsPage />, '/platform/analytics/policies');
    expect(await screen.findByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('700')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText(/all markets/)).toBeInTheDocument();
    expect(mocks.getPoliciesAnalytics.mock.calls[0][0]).toMatchObject({ granularity: 'daily' });
    expect(mocks.getPoliciesAnalytics.mock.calls[0][0].countryCode).toBeUndefined();
  });

  it('asks for one market when one is selected, and names it', async () => {
    mocks.getPoliciesAnalytics.mockResolvedValue({ ...view, countryCode: 'GH', currency: 'GHS' });
    renderAt(<PoliciesAnalyticsPage />, '/platform/analytics/policies?market=GH');
    await screen.findByText('1,234');
    expect(mocks.getPoliciesAnalytics.mock.calls[0][0].countryCode).toBe('GH');
    expect(screen.getByText(/Policy creation and status trends — Ghana/)).toBeInTheDocument();
  });

  it('says so when the request fails', async () => {
    mocks.getPoliciesAnalytics.mockRejectedValue(new Error('down'));
    renderAt(<PoliciesAnalyticsPage />, '/platform/analytics/policies');
    expect(await screen.findByText(/couldn't load policy analytics/i)).toBeInTheDocument();
  });
});

describe('DamageAnalyticsPage', () => {
  const view: DamageAnalyticsView = {
    countryCode: null,
    currency: null,
    avgWeather: 0.4,
    avgSatellite: 0.3,
    avgCombined: 0.35,
    triggerRate: 0.5,
    total: 1,
    assessments: [
      {
        id: 'a1',
        policyNumber: 'POL-GH-1',
        weatherDamage: 0.4,
        satelliteDamage: 0.3,
        combinedDamage: 0.65,
        triggered: true,
        triggerDate: '2026-10-01T00:00:00Z',
      },
    ],
  };

  it('shows the averages as percentages and lists the assessments, across all markets', async () => {
    mocks.getDamageAnalytics.mockResolvedValue(view);
    renderAt(<DamageAnalyticsPage />, '/platform/analytics/damage');
    expect(await screen.findByText('POL-GH-1')).toBeInTheDocument();
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30%').length).toBeGreaterThan(0);
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(mocks.getDamageAnalytics.mock.calls[0][0].countryCode).toBeUndefined();
    expect(mocks.getDamageAnalytics.mock.calls[0][0]).not.toHaveProperty('granularity');
  });

  it('asks for one market when one is selected', async () => {
    mocks.getDamageAnalytics.mockResolvedValue(view);
    renderAt(<DamageAnalyticsPage />, '/platform/analytics/damage?market=KE');
    await screen.findByText('POL-GH-1');
    expect(mocks.getDamageAnalytics.mock.calls[0][0].countryCode).toBe('KE');
    expect(screen.getByText(/trigger rates — Kenya/)).toBeInTheDocument();
  });
});
