/**
 * NEW POLICY is quoted only for a crop the organization's market SELLS.
 *
 * A plot registered with a coming-soon crop (or a legacy crop the market never listed) stays a
 * valid plot, but the page says why it cannot be quoted instead of firing a quote the server
 * will refuse. A catalogue refusal that does come back is shown in words, not swallowed.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { KE_CATALOGUE } from '@/test/catalogue-fixtures';
import type { CatalogueMarket } from '@/types/catalogue';

/** Kenya's catalogue with one crop the SERVER has stopped selling (e.g. not priced). */
function keWithUnsellable(code: string): CatalogueMarket {
  return {
    ...KE_CATALOGUE,
    lines: {
      ...KE_CATALOGUE.lines,
      CROP: KE_CATALOGUE.lines.CROP.map((c) =>
        c.code === code ? { ...c, sellable: false, reason: 'PRICING_NOT_CONFIGURED' } : c,
      ),
    },
  };
}

const mocks = vi.hoisted(() => ({
  getCatalogue: vi.fn(),
  getMyOrganization: vi.fn(),
  getMyCapabilities: vi.fn(),
  getMyKyb: vi.fn(),
  getFarmers: vi.fn(),
  getPlots: vi.fn(),
  getPolicyQuote: vi.fn(),
  purchasePolicy: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: mocks }));
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock('@/stores/authStore', () => {
  const state = {
    user: { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' },
    isPlatformAdmin: () => false,
  };
  const useAuthStore = (selector?: (s: unknown) => unknown) => (selector ? selector(state) : state);
  return { useAuthStore };
});

import NewPolicyPage from '../NewPolicyPage';

const FARMER = { id: 'f1', firstName: 'Wanjiku', lastName: 'Kamau', phoneNumber: '+254700000000', kycStatus: 'APPROVED' };
const PLOTS = [
  { id: 'p-maize', farmerId: 'f1', name: 'North', cropType: 'MAIZE', acreage: '2' },
  { id: 'p-wheat', farmerId: 'f1', name: 'South', cropType: 'WHEAT', acreage: '1' },
  { id: 'p-tea', farmerId: 'f1', name: 'Hill', cropType: 'TEA', acreage: '1' },
];

function renderPage(
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }),
) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NewPolicyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function choose(combobox: RegExp | string, option: RegExp) {
  const triggers = await screen.findAllByRole('combobox');
  const trigger = triggers.find((t) => (typeof combobox === 'string' ? t.textContent?.includes(combobox) : combobox.test(t.textContent ?? '')));
  fireEvent.click(trigger as HTMLElement);
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => {
  mocks.getCatalogue.mockReset().mockResolvedValue({ markets: [KE_CATALOGUE] });
  mocks.getMyOrganization.mockReset().mockResolvedValue({ id: 'org-1', countryCode: 'KE' });
  mocks.getMyCapabilities.mockReset().mockResolvedValue({
    capabilities: [{ capability: 'CROP_UNDERWRITING', enabled: true }],
  });
  mocks.getMyKyb.mockReset().mockResolvedValue({ kybStatus: 'APPROVED' });
  mocks.getFarmers.mockReset().mockResolvedValue({ data: [FARMER] });
  mocks.getPlots.mockReset().mockResolvedValue({ data: PLOTS });
  mocks.getPolicyQuote.mockReset().mockResolvedValue({ premium: 500, platformFee: 50, totalCost: 550 });
});

describe('NewPolicyPage and the catalogue', () => {
  it('labels plots with their crop from the catalogue', async () => {
    renderPage();
    await choose('Select farmer', /Wanjiku/);
    await choose('Select plot', /North · Maize/);
    expect(await screen.findByText('Maize')).toBeInTheDocument();
  });

  it('quotes a sellable crop', async () => {
    renderPage();
    await choose('Select farmer', /Wanjiku/);
    await choose('Select plot', /North/);
    await waitFor(() => expect(mocks.getPolicyQuote).toHaveBeenCalled());
    expect(await screen.findByText('Premium')).toBeInTheDocument();
  });

  it('does not quote a coming-soon crop, says why, and blocks Continue', async () => {
    renderPage();
    await choose('Select farmer', /Wanjiku/);
    await choose('Select plot', /South/);
    expect(await screen.findByText(/Wheat cover is coming soon in Kenya/)).toBeInTheDocument();
    expect(mocks.getPolicyQuote).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('does not quote a legacy crop the market never listed', async () => {
    renderPage();
    await choose('Select farmer', /Wanjiku/);
    await choose('Select plot', /Hill/);
    expect(await screen.findByText(/Tea is not in the Kenya product catalogue/)).toBeInTheDocument();
    expect(mocks.getPolicyQuote).not.toHaveBeenCalled();
  });

  it('shows a catalogue refusal from the quote in words', async () => {
    mocks.getPolicyQuote.mockRejectedValue(
      new ApiError('Pricing not configured', 409, 'PRICING_NOT_CONFIGURED', undefined, {
        countryCode: 'KE', line: 'CROP', item: 'MAIZE',
      }),
    );
    renderPage();
    await choose('Select farmer', /Wanjiku/);
    await choose('Select plot', /North/);
    expect(await screen.findByText(/Pricing for maize is not configured in Kenya yet/)).toBeInTheDocument();
  });

  it('holds the quote — and Continue — while the catalogue is still loading', async () => {
    mocks.getCatalogue.mockReset().mockReturnValue(new Promise(() => {}));
    renderPage();
    await choose('Select farmer', /Wanjiku/);
    await choose('Select plot', /North/);
    // Give an eager quote every chance to fire.
    await waitFor(() => expect(mocks.getPlots).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.getPolicyQuote).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('holds the quote — and Continue — when the catalogue failed to load', async () => {
    mocks.getCatalogue.mockReset().mockRejectedValue(new Error('down'));
    renderPage();
    await choose('Select farmer', /Wanjiku/);
    await choose('Select plot', /North/);
    expect(await screen.findByText(/couldn't load your market's product list/i)).toBeInTheDocument();
    expect(mocks.getPolicyQuote).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it("does not quote a PILOT crop the server marks unsellable, and gives the server's reason", async () => {
    mocks.getCatalogue.mockResolvedValue({ markets: [keWithUnsellable('SORGHUM')] });
    mocks.getPlots.mockResolvedValue({
      data: [{ id: 'p-sorghum', farmerId: 'f1', name: 'East', cropType: 'SORGHUM', acreage: '1' }],
    });
    renderPage();
    await choose('Select farmer', /Wanjiku/);
    await choose('Select plot', /East/);
    expect(
      await screen.findByText('Sorghum cannot be quoted or sold in Kenya yet — pricing not configured yet.'),
    ).toBeInTheDocument();
    expect(mocks.getPolicyQuote).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('disables Create Policy if the crop stops being sellable after Continue', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    renderPage(client);
    await choose('Select farmer', /Wanjiku/);
    await choose('Select plot', /North/);
    await screen.findByText('Premium');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const create = await screen.findByRole('button', { name: 'Create Policy' });
    expect(create).toBeEnabled();

    // The catalogue refreshes and the server no longer sells maize.
    client.setQueryData(['catalogue', 'org-1'], { markets: [keWithUnsellable('MAIZE')] });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Policy' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Create Policy' }));
    expect(mocks.purchasePolicy).not.toHaveBeenCalled();
  });
});
