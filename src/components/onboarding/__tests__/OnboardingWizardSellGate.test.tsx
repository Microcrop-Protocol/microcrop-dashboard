/**
 * THE CROP WIZARD'S SELL GATE. A plot may be registered for any LISTED crop — a coming-soon one
 * included — but Get Quote, Continue to Purchase and Purchase Policy are only for a crop the
 * SERVER says is sellable. The gate is checked again on every step, so a crop the server stops
 * selling between the quote and the purchase cannot be bought.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KE_CATALOGUE } from '@/test/catalogue-fixtures';
import type { CatalogueMarket } from '@/types/catalogue';
import type { GpsTrackResponse } from '@/types';

const mocks = vi.hoisted(() => ({
  registerFarmer: vi.fn(),
  fieldVerifyKyc: vi.fn(),
  createPlot: vi.fn(),
  getPolicyQuote: vi.fn(),
  purchasePolicy: vi.fn(),
  getCatalogue: vi.fn(),
  getMyOrganization: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: mocks }));
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock('@/stores/authStore', () => {
  const state = { user: { id: 'u1', role: 'ORG_FIELD_AGENT', organizationId: 'org-ke' } };
  const useAuthStore = (selector?: (s: unknown) => unknown) => (selector ? selector(state) : state);
  return { useAuthStore };
});
vi.mock('@/components/farmers/FarmerConsentPanel', () => ({ FarmerConsentPanel: () => <div /> }));
vi.mock('@/components/onboarding/BoundaryReviewMap', () => ({ BoundaryReviewMap: () => <div /> }));
vi.mock('@/components/onboarding/BoundaryWalkStep', () => ({
  BoundaryWalkStep: ({ onComplete }: { onComplete: (r: GpsTrackResponse) => void }) => (
    <button
      type="button"
      onClick={() =>
        onComplete({
          plot: { boundary: { type: 'Polygon', coordinates: [] }, centroidLat: -0.3, centroidLon: 36.1, areaHectares: 1 },
          metadata: { finalVertices: 4, avgAccuracy: 3, pointsFilteredOut: 0, totalPointsReceived: 4 },
        } as unknown as GpsTrackResponse)
      }
    >
      Finish walk
    </button>
  ),
}));

import { OnboardingWizard } from '../OnboardingWizard';

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

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OnboardingWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

/** Register → consent → KYC → plot (with `crop`) → walk → review, landing on the quote step. */
async function reachQuoteStep(crop: RegExp) {
  await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Wanjiku' } });
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Mwangi' } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+254712345678' } });
  fireEvent.change(screen.getByLabelText(/national id/i), { target: { value: 'KE-00001' } });
  fireEvent.change(screen.getByLabelText(/^county/i), { target: { value: 'Nakuru' } });
  fireEvent.change(screen.getByLabelText(/^sub-county/i), { target: { value: 'Njoro' } });
  fireEvent.click(screen.getByRole('button', { name: /register farmer/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^continue$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /confirm identity verification/i }));

  fireEvent.change(await screen.findByLabelText(/plot name/i), { target: { value: 'North' } });
  fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '-0.3' } });
  fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '36.1' } });
  fireEvent.change(screen.getByLabelText(/acreage/i), { target: { value: '2' } });
  const field = screen.getByText(/crop type/i).closest('div') as HTMLElement;
  fireEvent.click(within(field).getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: crop }));
  fireEvent.click(screen.getByRole('button', { name: /create plot/i }));

  fireEvent.click(await screen.findByRole('button', { name: 'Finish walk' }));
  fireEvent.click(await screen.findByRole('button', { name: /confirm boundary/i }));
  await screen.findByText('Insurance Coverage');
}

beforeEach(() => {
  mocks.getCatalogue.mockReset().mockResolvedValue({ markets: [KE_CATALOGUE] });
  mocks.getMyOrganization.mockReset().mockResolvedValue({ id: 'org-ke', countryCode: 'KE' });
  mocks.registerFarmer.mockReset().mockResolvedValue({
    id: 'farmer-1', firstName: 'Wanjiku', lastName: 'Mwangi', phoneNumber: '+254712345678',
    nationalId: 'KE-00001', county: 'Nakuru', kycStatus: 'PENDING',
  });
  mocks.fieldVerifyKyc.mockReset().mockResolvedValue({ id: 'farmer-1', kycStatus: 'APPROVED' });
  mocks.createPlot.mockReset().mockImplementation(async (_farmerId: string, data: { name: string; cropType: string }) => ({
    id: 'plot-1', farmerId: 'farmer-1', name: data.name, cropType: data.cropType, acreage: 2,
  }));
  mocks.getPolicyQuote.mockReset().mockResolvedValue({
    sumInsured: 10000, coverageType: 'DROUGHT', durationDays: 90, premium: 500, platformFee: 50, totalCost: 550, riskScore: 0.1,
  });
  mocks.purchasePolicy.mockReset();
});

describe('OnboardingWizard sell gate', () => {
  it('registers a coming-soon crop, then refuses to quote it', async () => {
    renderWizard();
    await reachQuoteStep(/Wheat/);
    expect(mocks.createPlot).toHaveBeenCalledWith('farmer-1', expect.objectContaining({ cropType: 'WHEAT' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Wheat cover is coming soon in Kenya/);
    const getQuote = screen.getByRole('button', { name: /get quote/i });
    expect(getQuote).toBeDisabled();
    fireEvent.click(getQuote);
    expect(mocks.getPolicyQuote).not.toHaveBeenCalled();
  });

  it('hides Continue to Purchase, and disables Purchase Policy, once the server stops selling the crop', async () => {
    const client = renderWizard();
    await reachQuoteStep(/Maize/);

    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    fireEvent.click(await screen.findByRole('button', { name: /continue to purchase/i }));
    expect(await screen.findByRole('button', { name: /purchase policy/i })).toBeEnabled();

    client.setQueryData(['catalogue', 'org-ke'], { markets: [keWithUnsellable('MAIZE')] });
    await waitFor(() => expect(screen.getByRole('button', { name: /purchase policy/i })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /purchase policy/i }));
    expect(mocks.purchasePolicy).not.toHaveBeenCalled();

    // Back on the quote step the reason is said and there is no way forward.
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(await screen.findByText(/pricing not configured yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue to purchase/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recalculate/i })).toBeDisabled();
  });
});
