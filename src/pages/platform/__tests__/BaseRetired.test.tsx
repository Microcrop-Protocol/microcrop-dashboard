/**
 * BASE RETIRED (phase 1). With VITE_BASE_SETTLEMENT_ENABLED unset (the default) a platform
 * admin is offered no Base action: no wallet provisioning, no on-chain reserve ratio, no
 * BaseScan link, no reserve read, and the PlatformTreasury page queries nothing. The switch
 * set to "true" restores them, which is what makes phase 1 reversible.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getOrganization: vi.fn(),
  getOrganizationStats: vi.fn(),
  getOrgReserve: vi.fn(),
  getOrgPoliciesAsPlatform: vi.fn(),
  getOrgPayoutsAsPlatform: vi.fn(),
  platformProvisionWallet: vi.fn(),
  platformSetReserveRatio: vi.fn(),
  getTreasuryStats: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: mocks }));
vi.mock('@/components/platform/OrgCapabilitiesCard', () => ({ OrgCapabilitiesCard: () => null }));

import OrganizationDetailPage from '../OrganizationDetailPage';
import TreasuryPage from '../TreasuryPage';

function renderAt(ui: ReactElement, path = '/platform/organizations/org-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/platform/organizations/:orgId" element={ui} />
          <Route path="/platform/treasury" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ORG = {
  id: 'org-1',
  name: 'Acme Insurance',
  type: 'INSURANCE_COMPANY',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  onboardingStep: 'COMPLETED',
  countryCode: 'KE',
  walletAddress: `0x${'a'.repeat(40)}`,
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getOrganization.mockResolvedValue(ORG);
  mocks.getOrganizationStats.mockResolvedValue({});
  mocks.getOrgReserve.mockResolvedValue({ walletAddress: ORG.walletAddress, solvent: true, reserveUsdc: 1, requiredUsdc: 1, headroomUsdc: 0 });
  mocks.getOrgPoliciesAsPlatform.mockResolvedValue({ data: [] });
  mocks.getOrgPayoutsAsPlatform.mockResolvedValue({ data: [] });
  mocks.getTreasuryStats.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('with Base retired (default)', () => {
  beforeEach(() => vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', ''));

  it('offers no Base wallet or reserve action on an organization, even one with a legacy wallet', async () => {
    renderAt(<OrganizationDetailPage />);
    expect(await screen.findByText('Acme Insurance')).toBeInTheDocument();
    expect(screen.getByText(/Base settlement is retired/)).toBeInTheDocument();
    expect(screen.queryByText('Provision Wallet')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Reserve Ratio')).not.toBeInTheDocument();
    expect(screen.queryByText('View Wallet')).not.toBeInTheDocument();
    expect(screen.getByText('Reserve Setup')).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('basescan');
    expect(mocks.getOrgReserve).not.toHaveBeenCalled();
  });

  it('shows the treasury as retired and queries nothing', async () => {
    renderAt(<TreasuryPage />, '/platform/treasury');
    expect(screen.getByText('There is no platform treasury')).toBeInTheDocument();
    expect(mocks.getTreasuryStats).not.toHaveBeenCalled();
  });
});

describe('with the Base switch on', () => {
  beforeEach(() => vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', 'true'));

  it('restores the wallet and reserve actions', async () => {
    renderAt(<OrganizationDetailPage />);
    expect(await screen.findByText('Acme Insurance')).toBeInTheDocument();
    expect(screen.getAllByText('Set Reserve Ratio').length).toBeGreaterThan(0);
    expect(screen.getByText('View Wallet').closest('a')).toHaveAttribute(
      'href',
      `https://basescan.org/address/${ORG.walletAddress}`,
    );
    await waitFor(() => expect(mocks.getOrgReserve).toHaveBeenCalledWith('org-1'));
  });

  it('queries the treasury again', async () => {
    renderAt(<TreasuryPage />, '/platform/treasury');
    await waitFor(() => expect(mocks.getTreasuryStats).toHaveBeenCalled());
  });
});
