/**
 * SETTINGS, and the fact that its tabs are ROUTES.
 *
 * Why that matters enough to test: MicroCrop's own support flow is "go to Settings →
 * Verification", and the backend's KYB decision emails point partners back at verification. A
 * `useState` tab index would make every pasted link, every bookmark and every reload land on the
 * wrong tab — and the one tab a partner is most often SENT to is the one they would have to find
 * by hand.
 *
 * Also pinned: an unrecognised tab segment resolves to Verification rather than rendering
 * nothing, because a stale or typo'd URL should land somewhere useful.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getMyKyb: vi.fn(),
  getMyOrganization: vi.fn(),
  getMyCapabilities: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getMyKyb: mocks.getMyKyb,
    getMyOrganization: mocks.getMyOrganization,
    getMyCapabilities: mocks.getMyCapabilities,
    submitMyKyb: vi.fn(),
  },
}));
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      user: { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' },
      isPlatformAdmin: () => false,
    };
    return selector ? selector(state) : state;
  },
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

import SettingsPage from '@/pages/org/SettingsPage';

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/org/settings" element={<SettingsPage />} />
          <Route path="/org/settings/:tab" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMyKyb.mockResolvedValue({
    kybStatus: 'VERIFIED',
    onboardingStep: 'COMPLETED',
    countryCode: 'GH',
    checklist: {
      countryCode: 'GH',
      regulator: 'NIC',
      regulatorLicenseRequired: true,
      regulatorLicenseDocType: 'NIC_LICENSE',
      adminDivisionLabels: { level1: 'Region', level2: 'District' },
      requiredDocuments: [],
      optionalDocuments: [],
    },
    verification: { id: 'v1', status: 'VERIFIED', documents: [] },
  });
  mocks.getMyOrganization.mockResolvedValue({
    id: 'org-1',
    name: 'Accra Mutual',
    countryCode: 'GH',
    type: 'INSURANCE_COMPANY',
    serviceTier: 'DETERMINATION',
    registrationNumber: 'CS-123456',
    county: 'Greater Accra',
  });
  mocks.getMyCapabilities.mockResolvedValue({
    capabilities: [
      { capability: 'CROP_UNDERWRITING', label: 'Crop underwriting', enabled: true },
      { capability: 'LIVESTOCK_UNDERWRITING', label: 'Livestock (IBLI) underwriting', enabled: false },
      { capability: 'BULK_IMPORT', label: 'Bulk farmer/plot import', enabled: false },
      { capability: 'DATA_EXPORT', label: 'Data export', enabled: true },
      { capability: 'PARTNER_WEBHOOKS', label: 'Partner webhooks', enabled: false },
      { capability: 'PARTNER_API_ACCESS', label: 'Partner API access', enabled: false },
      { capability: 'SANDBOX_SIMULATION', label: 'Sandbox simulated payments', enabled: false },
    ],
  });
});

describe('the tab is the URL', () => {
  it('defaults to Verification at /org/settings', async () => {
    renderAt('/org/settings');
    expect(await screen.findByRole('tab', { name: 'Verification', selected: true })).toBeTruthy();
  });

  it('opens the tab named in the path', async () => {
    renderAt('/org/settings/plan');
    expect(
      await screen.findByRole('tab', { name: /plan & features/i, selected: true }),
    ).toBeTruthy();
  });

  it('falls back to Verification for an unrecognised segment rather than rendering nothing', async () => {
    renderAt('/org/settings/not-a-tab');
    expect(await screen.findByRole('tab', { name: 'Verification', selected: true })).toBeTruthy();
  });

  it('navigates — and replaces, so Back does not walk every tab visited', async () => {
    renderAt('/org/settings/verification');
    // Radix TabsTrigger selects on mouseDown, not on click, so a bare `click` fires no
    // onValueChange and the test would pass while the navigation never happened.
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Organization' }));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/org/settings/organization', { replace: true }),
    );
  });
});

describe('only the active tab fetches', () => {
  it('does not read the capability map while on Verification', async () => {
    renderAt('/org/settings/verification');
    await screen.findByRole('tab', { name: 'Verification', selected: true });
    // Radix unmounts an inactive TabsContent, which is what keeps three tabs from firing three
    // sets of requests on every visit to any one of them.
    expect(mocks.getMyCapabilities).not.toHaveBeenCalled();
  });

  it('reads the capability map once Plan is open', async () => {
    renderAt('/org/settings/plan');
    await waitFor(() => expect(mocks.getMyCapabilities).toHaveBeenCalled());
  });
});

describe('Organization tab — the market, which used to be invisible', () => {
  it('shows the country, the currency and the regulator', async () => {
    renderAt('/org/settings/organization');

    expect(await screen.findByText('Ghana')).toBeInTheDocument();
    expect(screen.getByText('GHS (GH₵)')).toBeInTheDocument();
    expect(screen.getByText('NIC')).toBeInTheDocument();
  });

  it('labels the administrative division per market', async () => {
    renderAt('/org/settings/organization');
    expect(await screen.findByText('Region / District')).toBeInTheDocument();
    expect(screen.queryByText('County / Sub-County')).not.toBeInTheDocument();
  });

  it('says livestock is unavailable in a crop-only market', async () => {
    renderAt('/org/settings/organization');
    expect(await screen.findByText(/crop cover only/i)).toBeInTheDocument();
  });

  it('presents the sum-insured bounds as a guide, not as the rule', async () => {
    // policy.service enforces them inside the purchase transaction; presenting a mirrored limit
    // as authoritative is how a dashboard ends up disagreeing with a refusal.
    renderAt('/org/settings/organization');
    expect(await screen.findByText(/the limit is applied when you buy/i)).toBeInTheDocument();
  });
});

describe('Plan tab — the partner-facing capability list', () => {
  it('marks what is included and what is not', async () => {
    renderAt('/org/settings/plan');

    await screen.findByText('Crop underwriting');
    expect(screen.getAllByText('Included').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not on your plan').length).toBeGreaterThan(0);
  });

  it('lists every capability, including the ones that are off', async () => {
    renderAt('/org/settings/plan');
    await screen.findByText('Crop underwriting');
    expect(screen.getByText('Bulk farmer/plot import')).toBeInTheDocument();
    expect(screen.getByText('Sandbox simulated payments')).toBeInTheDocument();
  });

  it('offers no control — a capability is not self-serve', async () => {
    renderAt('/org/settings/plan');
    await screen.findByText('Crop underwriting');
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('names the service plan', async () => {
    renderAt('/org/settings/plan');
    expect(await screen.findByText(/on the determination plan/i)).toBeInTheDocument();
  });

  it('never shows the operator reason, which the org-facing API does not send', async () => {
    renderAt('/org/settings/plan');
    await screen.findByText('Crop underwriting');
    expect(document.body.textContent).not.toMatch(/reason on file/i);
  });
});
