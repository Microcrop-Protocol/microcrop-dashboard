/**
 * BASE RETIRED: "Retry" on a FAILED payout re-submits a Base settlement, which the backend now
 * refuses with 409 BASE_RETIRED — and the kill switch itself parks Base rows as FAILED. So the
 * button is hidden while VITE_BASE_SETTLEMENT_ENABLED is off and comes back when it is "true".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Payout } from '@/types';

const mocks = vi.hoisted(() => ({ getPayouts: vi.fn(), retryPayout: vi.fn() }));

vi.mock('@/lib/api', () => ({ api: mocks }));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { organizationId: 'org-1' } }),
}));
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: { retryPayouts: true } }),
}));
vi.mock('@/hooks/useOrgMarket', () => ({
  useOrgMarket: () => ({ market: null, mobileMoneyLabel: 'mobile money' }),
}));
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));

import PayoutsPage from '../PayoutsPage';

const FAILED: Payout = {
  id: 'payout-1',
  policyId: 'policy-1',
  policyNumber: 'POL-0001',
  farmerId: 'farmer-1',
  farmerName: 'Wanjiku Mwangi',
  farmerPhone: '+254700000000',
  amount: 12000,
  status: 'FAILED',
  createdAt: '2026-03-01T00:00:00Z',
} as Payout;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PayoutsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getPayouts.mockReset();
  mocks.getPayouts.mockResolvedValue({ data: [FAILED] });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('payout retry', () => {
  it('is not offered on a FAILED payout while Base is retired', async () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', '');
    renderPage();
    expect(await screen.findByText('Wanjiku Mwangi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('comes back with the Base switch on', async () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', 'true');
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
