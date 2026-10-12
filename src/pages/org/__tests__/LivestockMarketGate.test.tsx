/**
 * Ghana lists no livestock, and every livestock surface says so — plainly, with no roadmap
 * teaser — instead of rendering an empty herd table or an onboarding wizard whose every choice
 * the server would refuse. The nav hides the livestock entries there. In Kenya nothing changes.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GH_CATALOGUE, KE_CATALOGUE } from '@/test/catalogue-fixtures';

const mocks = vi.hoisted(() => ({
  country: 'GH' as 'GH' | 'KE',
  getCatalogue: vi.fn(),
  getMyOrganization: vi.fn(),
  getMyCapabilities: vi.fn(),
  getMyPermissions: vi.fn(),
  getHerds: vi.fn(),
  getForageAlerts: vi.fn(),
  getActiveInsuranceUnits: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getCatalogue: mocks.getCatalogue,
    getMyOrganization: mocks.getMyOrganization,
    getMyCapabilities: mocks.getMyCapabilities,
    getMyPermissions: mocks.getMyPermissions,
    getHerds: mocks.getHerds,
    getForageAlerts: mocks.getForageAlerts,
    getActiveInsuranceUnits: mocks.getActiveInsuranceUnits,
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
// The wizard is not under test here; only whether the page reaches it.
vi.mock('@/components/onboarding/LivestockOnboardingWizard', () => ({
  LivestockOnboardingWizard: () => <div data-testid="livestock-wizard" />,
}));

import LivestockOnboardingPage from '../LivestockOnboardingPage';
import HerdsPage from '../HerdsPage';
import ForageAlertsPage from '../ForageAlertsPage';
import { AppSidebar } from '@/components/layout/AppSidebar';

function renderPage(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getCatalogue.mockReset().mockImplementation(async () => ({
    markets: [mocks.country === 'GH' ? GH_CATALOGUE : KE_CATALOGUE],
  }));
  mocks.getMyOrganization.mockReset().mockImplementation(async () => ({
    id: 'org-1', countryCode: mocks.country,
  }));
  mocks.getMyCapabilities.mockReset().mockResolvedValue({
    capabilities: [{ capability: 'LIVESTOCK_UNDERWRITING', enabled: true }],
  });
  mocks.getMyPermissions.mockReset().mockResolvedValue({ role: 'ORG_ADMIN', permissions: ['*'] });
  mocks.getHerds.mockReset().mockResolvedValue({ data: [] });
  mocks.getForageAlerts.mockReset().mockResolvedValue({ data: [] });
  mocks.getActiveInsuranceUnits.mockReset().mockResolvedValue({ data: [] });
});

describe('in Ghana', () => {
  beforeEach(() => {
    mocks.country = 'GH';
  });

  it('livestock onboarding says livestock is not offered, and does not reach the wizard', async () => {
    renderPage(<LivestockOnboardingPage />);
    expect(await screen.findByText('Livestock cover is not offered in Ghana')).toBeInTheDocument();
    expect(screen.queryByTestId('livestock-wizard')).not.toBeInTheDocument();
    // No roadmap teaser: nothing about "coming", "soon" or "later".
    expect(document.body.textContent).not.toMatch(/coming|soon|later|roadmap/i);
  });

  it('herds says the same instead of rendering empty herd totals', async () => {
    renderPage(<HerdsPage />);
    expect(await screen.findByText('Livestock cover is not offered in Ghana')).toBeInTheDocument();
    expect(screen.queryByText('Total Herds')).not.toBeInTheDocument();
  });

  it('herds never asks for herds — it waits for the market, which says there are none', async () => {
    renderPage(<HerdsPage />);
    await screen.findByText('Livestock cover is not offered in Ghana');
    expect(mocks.getHerds).not.toHaveBeenCalled();
  });

  it('forage alerts says the same instead of "No forage alerts"', async () => {
    renderPage(<ForageAlertsPage />);
    expect(await screen.findByText('Livestock cover is not offered in Ghana')).toBeInTheDocument();
    expect(screen.queryByText('No forage alerts')).not.toBeInTheDocument();
  });

  it('forage alerts never asks for alerts before the market resolves', async () => {
    renderPage(<ForageAlertsPage />);
    await screen.findByText('Livestock cover is not offered in Ghana');
    expect(mocks.getForageAlerts).not.toHaveBeenCalled();
  });

  it('hides the livestock entries from the nav', async () => {
    renderPage(<AppSidebar isOpen onClose={() => {}} />);
    await waitFor(() => expect(screen.queryByText('Herds')).not.toBeInTheDocument());
    expect(screen.queryByText('Livestock Onboarding')).not.toBeInTheDocument();
    expect(screen.queryByText('Forage Alerts')).not.toBeInTheDocument();
    expect(screen.getByText('Field Onboarding')).toBeInTheDocument();
  });
});

describe('while the market is resolving', () => {
  beforeEach(() => {
    mocks.country = 'KE';
    mocks.getMyOrganization.mockReset().mockReturnValue(new Promise(() => {}));
  });

  it('herds sends no request and shows no empty totals yet', async () => {
    renderPage(<HerdsPage />);
    await waitFor(() => expect(mocks.getMyOrganization).toHaveBeenCalled());
    await waitFor(() => expect(mocks.getCatalogue).toHaveBeenCalled());
    expect(mocks.getHerds).not.toHaveBeenCalled();
  });

  it('forage alerts sends no request and does not claim there are no alerts', async () => {
    renderPage(<ForageAlertsPage />);
    await waitFor(() => expect(mocks.getMyOrganization).toHaveBeenCalled());
    expect(mocks.getForageAlerts).not.toHaveBeenCalled();
    expect(screen.queryByText('No forage alerts')).not.toBeInTheDocument();
  });
});

describe('in Kenya', () => {
  beforeEach(() => {
    mocks.country = 'KE';
  });

  it('herds and forage alerts ask for their data once the market resolves', async () => {
    renderPage(<HerdsPage />);
    await waitFor(() => expect(mocks.getHerds).toHaveBeenCalled());
    renderPage(<ForageAlertsPage />);
    await waitFor(() => expect(mocks.getForageAlerts).toHaveBeenCalled());
    expect(await screen.findByText('No forage alerts')).toBeInTheDocument();
  });

  it('livestock onboarding reaches the wizard', async () => {
    renderPage(<LivestockOnboardingPage />);
    expect(await screen.findByTestId('livestock-wizard')).toBeInTheDocument();
  });

  it('keeps the livestock entries in the nav', async () => {
    renderPage(<AppSidebar isOpen onClose={() => {}} />);
    await waitFor(() => expect(mocks.getCatalogue).toHaveBeenCalled());
    expect(screen.getByText('Herds')).toBeInTheDocument();
    expect(screen.getByText('Livestock Onboarding')).toBeInTheDocument();
  });

  it('labels herd types from the catalogue', async () => {
    mocks.getHerds.mockResolvedValue({
      data: [{
        id: 'h1', farmerId: 'f1', organizationId: 'org-1', name: 'Main', livestockType: 'CAMEL',
        headCount: 3, estimatedValue: '1000', tluCount: '4.2', createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    renderPage(<HerdsPage />);
    expect((await screen.findAllByText('Camel')).length).toBeGreaterThan(0);
  });
});
