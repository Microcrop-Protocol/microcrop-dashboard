/**
 * THE CROP ON A POLICY comes from its PLOT. The Policy row has no crop column, so `GET /policies`
 * never sent a flat `cropType` and the Crop column rendered blank; the backend now includes
 * `plot.cropType`. The list and the detail page label it from the market catalogue, fall back to
 * the RAW code when the catalogue has no label for it (not loaded, or a legacy crop), and are never
 * blank.
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Policy } from '@/types';
import { KE_CATALOGUE } from '@/test/catalogue-fixtures';

const mocks = vi.hoisted(() => ({
  getPolicies: vi.fn(),
  getPolicy: vi.fn(),
  getPayouts: vi.fn(),
  getDamageAssessments: vi.fn(),
  getCatalogue: vi.fn(),
  getMyOrganization: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: mocks }));
vi.mock('@/stores/authStore', () => {
  const state = { user: { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' } };
  const useAuthStore = (selector?: (s: unknown) => unknown) => (selector ? selector(state) : state);
  return { useAuthStore };
});
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: { writePolicies: false } }),
}));
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));

import PoliciesPage from '../PoliciesPage';
import PolicyDetailPage from '../PolicyDetailPage';

function policy(id: string, plot: Policy['plot'], overrides: Partial<Policy> = {}): Policy {
  return {
    id,
    policyNumber: `POL-${id}`,
    organizationId: 'org-1',
    farmerId: 'f1',
    farmerName: 'Wanjiku Mwangi',
    plotId: 'p1',
    plotName: 'North',
    status: 'ACTIVE',
    coverageType: 'DROUGHT',
    sumInsured: '50000',
    premium: '2500',
    platformFee: '250',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-06-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    plot,
    ...overrides,
  };
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/org/policies" element={<PoliciesPage />} />
          <Route path="/org/policies/:policyId" element={<PolicyDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rowOf = async (policyNumber: string) => (await screen.findByText(policyNumber)).closest('tr') as HTMLElement;

beforeEach(() => {
  mocks.getCatalogue.mockReset().mockResolvedValue({ markets: [KE_CATALOGUE] });
  mocks.getMyOrganization.mockReset().mockResolvedValue({ id: 'org-1', countryCode: 'KE' });
  mocks.getPayouts.mockReset().mockResolvedValue({ data: [] });
  mocks.getDamageAssessments.mockReset().mockResolvedValue({ data: [] });
  mocks.getPolicies.mockReset().mockResolvedValue({
    data: [
      policy('1', { name: 'North', cropType: 'GREEN_GRAMS' }),
      policy('2', { name: 'Hill', cropType: 'TEA' }),
      policy('3', null),
    ],
  });
});

describe('PoliciesPage crop column', () => {
  it("labels the plot's crop from the catalogue, shows an unlisted crop's raw code, and is never blank", async () => {
    renderAt('/org/policies');
    expect(await within(await rowOf('POL-1')).findByText('Green grams')).toBeInTheDocument();
    expect(within(await rowOf('POL-2')).getByText('TEA')).toBeInTheDocument();
    // A policy with no plot (livestock) says so with a dash rather than an empty cell.
    expect(within(await rowOf('POL-3')).getByText('—')).toBeInTheDocument();
  });

  it('shows the raw code while the catalogue cannot label it', async () => {
    mocks.getCatalogue.mockReset().mockRejectedValue(new Error('down'));
    renderAt('/org/policies');
    expect(within(await rowOf('POL-1')).getByText('GREEN_GRAMS')).toBeInTheDocument();
  });

  it('still reads a flat cropType from an older payload', async () => {
    mocks.getPolicies.mockResolvedValue({ data: [policy('4', undefined, { cropType: 'MAIZE' })] });
    renderAt('/org/policies');
    expect(await within(await rowOf('POL-4')).findByText('Maize')).toBeInTheDocument();
  });
});

describe('PolicyDetailPage crop', () => {
  it("names the plot's crop in the header", async () => {
    mocks.getPolicy.mockResolvedValue(policy('1', { name: 'North', cropType: 'SORGHUM' }));
    renderAt('/org/policies/1');
    expect(await screen.findByText(/Wanjiku Mwangi • North • Sorghum/)).toBeInTheDocument();
  });

  it('falls back to the raw code for a crop the catalogue does not list', async () => {
    mocks.getPolicy.mockResolvedValue(policy('2', { name: 'Hill', cropType: 'TEA' }));
    renderAt('/org/policies/2');
    expect(await screen.findByText(/North • TEA/)).toBeInTheDocument();
  });
});
