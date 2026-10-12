/**
 * PLATFORM ANALYTICS PAGES AND THE MARKET.
 *
 *   1. MONEY PAGES ARE SINGLE-MARKET. Revenue and payouts never offer "All markets", default to
 *      the first registry market, and SAY which market they are showing.
 *   2. LOCAL MONEY IS LABELLED ONLY WHEN THE SERVER CONFIRMS THE MARKET. A response with no echo
 *      renders unlabelled figures and a notice — never KES by default.
 *   3. PAYOUTS ARE USDC on every page that shows them.
 *   4. FARMERS-BY-AREA uses the market's own division label, and names the market on each area
 *      across markets.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FarmersAnalyticsView, PayoutsAnalyticsView, RevenueAnalyticsView } from '@/types';
import { MARKETS, SUPPORTED_COUNTRY_CODES } from '@/lib/market';

const mocks = vi.hoisted(() => ({
  getRevenueAnalytics: vi.fn(),
  getPayoutsAnalytics: vi.fn(),
  getFarmersAnalytics: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getRevenueAnalytics: mocks.getRevenueAnalytics,
    getPayoutsAnalytics: mocks.getPayoutsAnalytics,
    getFarmersAnalytics: mocks.getFarmersAnalytics,
  },
}));

import RevenueAnalyticsPage from '../analytics/RevenueAnalyticsPage';
import PayoutsAnalyticsPage from '../analytics/PayoutsAnalyticsPage';
import FarmersAnalyticsPage from '../analytics/FarmersAnalyticsPage';

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

  it('reports payouts in USDC and a missing loss ratio as a dash', async () => {
    mocks.getRevenueAnalytics.mockResolvedValue(revenue());
    renderAt(<RevenueAnalyticsPage />, '/platform/analytics/revenue?market=GH');
    expect(await screen.findByText('USDC 300')).toBeInTheDocument();
    expect(screen.getByText('Needs USDC-denominated premiums')).toBeInTheDocument();
    expect(screen.queryByText(/net revenue/i)).not.toBeInTheDocument();
  });
});

describe('PayoutsAnalyticsPage', () => {
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
