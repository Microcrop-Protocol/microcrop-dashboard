/**
 * PLATFORM DASHBOARD — money per currency, payouts in USDC, counts from the nested shape.
 *
 * The old page read a flat shape the backend never sent (every tile showed 0) and formatted all
 * money as KES — including payouts, which are USDC, and Ghanaian premiums, which are GHS.
 */
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PlatformStats } from '@/types';

const mocks = vi.hoisted(() => ({
  getPlatformStats: vi.fn(),
  getActivities: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { getPlatformStats: mocks.getPlatformStats, getActivities: mocks.getActivities },
}));

import PlatformDashboard from '../PlatformDashboard';

const STATS: PlatformStats = {
  organizations: { total: 12, active: 10, inactive: 2 },
  policies: { total: 400, active: 250, periodNew: 31 },
  farmers: { total: 900 },
  financials: {
    byCurrency: [
      { countryCode: 'KE', currency: 'KES', totalPremiums: 150000, totalFees: 7500 },
      { countryCode: 'GH', currency: 'GHS', totalPremiums: 4200, totalFees: 210 },
    ],
    totalPayoutsUsdc: 5120,
    totalPayoutCount: 14,
  },
  period: { start: null, end: null },
};

function renderPage(path = '/platform/dashboard') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <PlatformDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  mocks.getPlatformStats.mockReset().mockResolvedValue(STATS);
  mocks.getActivities.mockReset().mockResolvedValue({ data: [] });
});

describe('PlatformDashboard', () => {
  it('reads the counts from the nested overview shape', async () => {
    renderPage();
    expect(await screen.findByText('10 active')).toBeInTheDocument();
    expect(screen.getByText('+31 this period')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
  });

  it('shows each market in its own currency and never adds them together', async () => {
    renderPage();
    const ke = await screen.findByTestId('financials-KE');
    const gh = screen.getByTestId('financials-GH');
    expect(within(ke).getByText(/^KES\s150(\.0)?K$/)).toBeInTheDocument();
    expect(within(gh).getByText(/^GHS\s4\.2K$/)).toBeInTheDocument();
    expect(within(gh).queryByText(/KES/)).not.toBeInTheDocument();
    // 150000 + 4200 would be the mixed-currency total the old tile showed.
    expect(screen.queryByText(/154\.2K/)).not.toBeInTheDocument();
  });

  it('labels payouts USDC, never a local currency — and as legacy Base while Base is retired', async () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', '');
    renderPage();
    expect(await screen.findByText('USDC 5.1K')).toBeInTheDocument();
    expect(screen.getByText('Legacy (Base) payouts (USDC)')).toBeInTheDocument();
    expect(screen.queryByText('Payouts Sent (USDC)')).not.toBeInTheDocument();
  });

  it('restores the "Payouts Sent" label with the Base switch on', async () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', 'true');
    renderPage();
    expect(await screen.findByText('USDC 5.1K')).toBeInTheDocument();
    expect(screen.getByText('Payouts Sent (USDC)')).toBeInTheDocument();
  });

  it('shows money the server did not send as "—", never as a confident zero', async () => {
    mocks.getPlatformStats.mockResolvedValue({
      ...STATS,
      financials: {
        byCurrency: [{ countryCode: 'KE', currency: 'KES', totalPremiums: null, totalFees: null }],
        totalPayoutsUsdc: null,
        totalPayoutCount: 0,
      },
    });
    renderPage();
    const ke = await screen.findByTestId('financials-KE');
    expect(within(ke).getAllByText('—')).toHaveLength(2);
    expect(within(ke).queryByText(/KES\s0|^0$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/USDC 0/)).not.toBeInTheDocument();
  });

  it('asks for every market by default, and for one when one is selected', async () => {
    renderPage();
    await screen.findByTestId('financials-KE');
    expect(mocks.getPlatformStats.mock.calls[0][0].countryCode).toBeUndefined();
    expect(mocks.getPlatformStats.mock.calls[0][0].startDate).toBeDefined();

    fireEvent.click(screen.getByRole('combobox', { name: /select market/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ghana (GHS)' }));

    await waitFor(() =>
      expect(mocks.getPlatformStats).toHaveBeenLastCalledWith(expect.objectContaining({ countryCode: 'GH' })),
    );
  });

  it('shows only the selected market\'s money even if the server returned more', async () => {
    renderPage('/platform/dashboard?market=GH');
    expect(await screen.findByTestId('financials-GH')).toBeInTheDocument();
    expect(screen.queryByTestId('financials-KE')).not.toBeInTheDocument();
  });
});
