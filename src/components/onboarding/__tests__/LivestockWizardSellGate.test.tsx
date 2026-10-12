/**
 * THE LIVESTOCK WIZARD'S SELL GATE. Calculate Premium, Proceed to Purchase and Create Policy are
 * only for a species the SERVER says is sellable, and the gate is re-checked on every step: a
 * species the server stops selling (for instance, unpriced) after the herd was registered can be
 * neither quoted nor bought.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KE_CATALOGUE } from '@/test/catalogue-fixtures';
import type { CatalogueMarket } from '@/types/catalogue';

const mocks = vi.hoisted(() => ({
  registerFarmer: vi.fn(),
  fieldVerifyKyc: vi.fn(),
  createHerd: vi.fn(),
  getActiveInsuranceUnits: vi.fn(),
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

import { LivestockOnboardingWizard } from '../LivestockOnboardingWizard';

function keWithUnsellableLivestock(code: string): CatalogueMarket {
  return {
    ...KE_CATALOGUE,
    lines: {
      ...KE_CATALOGUE.lines,
      LIVESTOCK: KE_CATALOGUE.lines.LIVESTOCK.map((item) =>
        item.code === code ? { ...item, sellable: false, reason: 'PRICING_NOT_CONFIGURED' } : item,
      ),
    },
  };
}

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LivestockOnboardingWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

async function chooseIn(label: RegExp, option: RegExp) {
  const field = screen.getByText(label).closest('div') as HTMLElement;
  fireEvent.click(within(field).getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

/** Register → consent → KYC → herd of cattle, landing on the quote step. */
async function reachQuoteStep() {
  await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ekai' } });
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lokol' } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+254712345678' } });
  fireEvent.change(screen.getByLabelText(/national id/i), { target: { value: '30000001' } });
  fireEvent.change(screen.getByLabelText(/^county/i), { target: { value: 'Turkana' } });
  fireEvent.change(screen.getByLabelText(/^sub-county/i), { target: { value: 'Turkana Central' } });
  fireEvent.click(screen.getByRole('button', { name: /register pastoralist/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^continue$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /approve & continue/i }));

  fireEvent.change(await screen.findByLabelText(/herd name/i), { target: { value: 'Main herd' } });
  await waitFor(() => expect(mocks.getActiveInsuranceUnits).toHaveBeenCalled());
  await chooseIn(/coverage region/i, /KE-10/);
  await chooseIn(/livestock type/i, /Cattle/);
  fireEvent.click(screen.getByRole('button', { name: /register herd/i }));
  await screen.findByText('Policy Quote');
}

beforeEach(() => {
  mocks.getCatalogue.mockReset().mockResolvedValue({ markets: [KE_CATALOGUE] });
  mocks.getMyOrganization.mockReset().mockResolvedValue({ id: 'org-ke', countryCode: 'KE' });
  mocks.registerFarmer.mockReset().mockResolvedValue({
    id: 'farmer-1', firstName: 'Ekai', lastName: 'Lokol', phoneNumber: '+254712345678',
    nationalId: '30000001', county: 'Turkana', kycStatus: 'PENDING',
  });
  mocks.fieldVerifyKyc.mockReset().mockResolvedValue({ id: 'farmer-1', kycStatus: 'APPROVED' });
  mocks.getActiveInsuranceUnits.mockReset().mockResolvedValue({
    data: [{ id: 'unit-1', county: 'Turkana', subCounty: null, unitCode: 'KE-10', country: 'KE' }],
  });
  mocks.createHerd.mockReset().mockImplementation(async (data: Record<string, unknown>) => ({
    id: 'herd-1', farmerId: 'farmer-1', name: data.name, livestockType: data.livestockType,
    headCount: data.headCount, estimatedValue: String(data.estimatedValue), insuranceUnitId: data.insuranceUnitId,
  }));
  // The quote figures are whatever the mocked server returns; nothing here is a real price.
  mocks.getPolicyQuote.mockReset().mockResolvedValue({
    tluCount: 1, season: 'LRLD', premiumPerTLU: 100, premium: 100, platformFee: 10, totalCost: 110,
    sumInsured: 15000, insuranceUnitCode: 'KE-10',
  });
  mocks.purchasePolicy.mockReset();
});

describe('LivestockOnboardingWizard sell gate', () => {
  it('quotes a sellable species', async () => {
    renderWizard();
    await reachQuoteStep();
    expect(mocks.createHerd).toHaveBeenCalledWith(expect.objectContaining({ livestockType: 'CATTLE' }));
    const calculate = screen.getByRole('button', { name: /calculate premium/i });
    expect(calculate).toBeEnabled();
    fireEvent.click(calculate);
    await waitFor(() => expect(mocks.getPolicyQuote).toHaveBeenCalled());
  });

  it('disables Calculate Premium for a species the server stops selling', async () => {
    const client = renderWizard();
    await reachQuoteStep();
    client.setQueryData(['catalogue', 'org-ke'], { markets: [keWithUnsellableLivestock('CATTLE')] });

    expect(await screen.findByRole('alert')).toHaveTextContent(/Cattle cannot be quoted or sold in Kenya yet/);
    const calculate = screen.getByRole('button', { name: /calculate premium/i });
    expect(calculate).toBeDisabled();
    fireEvent.click(calculate);
    expect(mocks.getPolicyQuote).not.toHaveBeenCalled();
  });

  it('disables Proceed to Purchase once the species stops being sellable after the quote', async () => {
    const client = renderWizard();
    await reachQuoteStep();
    fireEvent.click(screen.getByRole('button', { name: /calculate premium/i }));
    const proceed = await screen.findByRole('button', { name: /proceed to purchase/i });
    expect(proceed).toBeEnabled();

    client.setQueryData(['catalogue', 'org-ke'], { markets: [keWithUnsellableLivestock('CATTLE')] });
    await waitFor(() => expect(screen.getByRole('button', { name: /proceed to purchase/i })).toBeDisabled());
  });

  it('disables Create Policy once the species stops being sellable on the purchase step', async () => {
    const client = renderWizard();
    await reachQuoteStep();
    fireEvent.click(screen.getByRole('button', { name: /calculate premium/i }));
    fireEvent.click(await screen.findByRole('button', { name: /proceed to purchase/i }));
    expect(await screen.findByRole('button', { name: /create policy/i })).toBeEnabled();

    client.setQueryData(['catalogue', 'org-ke'], { markets: [keWithUnsellableLivestock('CATTLE')] });
    await waitFor(() => expect(screen.getByRole('button', { name: /create policy/i })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /create policy/i }));
    expect(mocks.purchasePolicy).not.toHaveBeenCalled();
  });
});
