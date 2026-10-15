/**
 * THE LIVESTOCK WIZARD'S NAVIGABLE STEPPER — the same contract as the crop wizard's, through the
 * same shared component: completed steps reopen with state intact, future steps open only when
 * what they read exists, locked steps say why, and nothing before the policy can be submitted a
 * second time once it is created.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KE_CATALOGUE } from '@/test/catalogue-fixtures';

const mocks = vi.hoisted(() => ({
  registerFarmer: vi.fn(),
  fieldVerifyKyc: vi.fn(),
  createHerd: vi.fn(),
  getActiveInsuranceUnits: vi.fn(),
  getPolicyQuote: vi.fn(),
  purchasePolicy: vi.fn(),
  initiatePayment: vi.fn(),
  getPaymentStatusByRef: vi.fn(),
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

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LivestockOnboardingWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stepButton(title: string) {
  const nav = screen.getByRole('navigation', { name: /onboarding progress/i });
  return within(nav).getByRole('button', { name: new RegExp(`^${title}( \\(completed\\))?$`) });
}

async function chooseIn(label: RegExp, option: RegExp) {
  const field = screen.getByText(label).closest('div') as HTMLElement;
  fireEvent.click(within(field).getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

/** Register → consent → KYC, landing on the herd step. */
async function reachHerdStep() {
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
  await screen.findByLabelText(/herd name/i);
}

/** …→ herd, landing on the quote step with no quote yet. */
async function reachQuoteStep() {
  await reachHerdStep();
  fireEvent.change(screen.getByLabelText(/herd name/i), { target: { value: 'Main herd' } });
  await waitFor(() => expect(mocks.getActiveInsuranceUnits).toHaveBeenCalled());
  await chooseIn(/coverage region/i, /KE-10/);
  await chooseIn(/livestock type/i, /Cattle/);
  fireEvent.click(screen.getByRole('button', { name: /register herd/i }));
  await screen.findByRole('button', { name: /calculate premium/i });
}

/** …→ quote → purchase, landing on the payment step. */
async function reachPaymentStep() {
  await reachQuoteStep();
  fireEvent.click(screen.getByRole('button', { name: /calculate premium/i }));
  fireEvent.click(await screen.findByRole('button', { name: /proceed to purchase/i }));
  fireEvent.click(await screen.findByRole('button', { name: /create policy/i }));
  await screen.findByRole('button', { name: /send payment prompt/i });
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
  mocks.getPolicyQuote.mockReset().mockResolvedValue({
    tluCount: 1, season: 'LRLD', premiumPerTLU: 100, premium: 100, platformFee: 10, totalCost: 110,
    sumInsured: 15000, insuranceUnitCode: 'KE-10',
  });
  mocks.purchasePolicy.mockReset().mockResolvedValue({
    policy: { id: 'policy-1', policyNumber: 'POL-0002' },
    paymentInstructions: { amount: 110 },
  });
  mocks.initiatePayment.mockReset();
  mocks.getPaymentStatusByRef.mockReset();
});

describe('LivestockOnboardingWizard stepper', () => {
  it('renders every step as a button and marks the current one', () => {
    renderWizard();
    const nav = screen.getByRole('navigation', { name: /onboarding progress/i });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Register', 'Consent', 'Verify', 'Herd', 'Quote', 'Purchase', 'Payment',
    ]);
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');
  });

  it('keeps a locked future step shut and says why', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    const herd = stepButton('Herd');
    expect(herd).toHaveAttribute('aria-disabled', 'true');
    expect(herd).toHaveAccessibleDescription('Register the pastoralist first');
    fireEvent.click(herd);
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');
  });

  it('goes back to a completed step with state intact, and opens a reachable future step', async () => {
    renderWizard();
    await reachHerdStep();
    fireEvent.change(screen.getByLabelText(/herd name/i), { target: { value: 'Main herd' } });
    expect(stepButton('Quote')).toHaveAccessibleDescription('Register the herd first');

    fireEvent.click(stepButton('Register'));
    expect(await screen.findByText('Pastoralist Registered')).toBeInTheDocument();
    expect(screen.getByText('Ekai Lokol')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /register pastoralist/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Herd'));
    expect(stepButton('Herd')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByLabelText(/herd name/i)).toHaveValue('Main herd');
    expect(mocks.registerFarmer).toHaveBeenCalledTimes(1);
  });

  it('after the policy is created, no earlier step can submit again', async () => {
    renderWizard();
    await reachPaymentStep();

    fireEvent.click(stepButton('Purchase'));
    expect(await screen.findByRole('note')).toHaveTextContent(/Policy POL-0002 has been created/);
    expect(screen.queryByRole('button', { name: /create policy/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Quote'));
    expect(await screen.findByText(/quote can no longer be changed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recalculate|calculate premium/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Herd'));
    expect(await screen.findByText('Herd Registered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /register herd/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Verify'));
    expect(await screen.findByText(/identity has been verified/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve & continue/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Register'));
    expect(screen.queryByRole('button', { name: /register pastoralist/i })).not.toBeInTheDocument();

    // And forward again to the payment step, which is still reachable.
    fireEvent.click(stepButton('Payment'));
    expect(await screen.findByRole('button', { name: /send payment prompt/i })).toBeInTheDocument();

    expect(mocks.registerFarmer).toHaveBeenCalledTimes(1);
    expect(mocks.fieldVerifyKyc).toHaveBeenCalledTimes(1);
    expect(mocks.createHerd).toHaveBeenCalledTimes(1);
    expect(mocks.purchasePolicy).toHaveBeenCalledTimes(1);
  });

  it('is operable from the keyboard', async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachHerdStep();

    stepButton('Consent').focus();
    await user.keyboard('{Enter}');
    expect(stepButton('Consent')).toHaveAttribute('aria-current', 'step');

    const purchase = stepButton('Purchase');
    purchase.focus();
    await user.keyboard('{Enter}');
    expect(stepButton('Consent')).toHaveAttribute('aria-current', 'step');

    stepButton('Herd').focus();
    await user.keyboard(' ');
    expect(stepButton('Herd')).toHaveAttribute('aria-current', 'step');
  });

  it('drops a quote once the season or peril changes, and buys only what was quoted', async () => {
    renderWizard();
    await reachQuoteStep();
    fireEvent.click(screen.getByRole('button', { name: /calculate premium/i }));
    await screen.findByRole('button', { name: /proceed to purchase/i });
    expect(stepButton('Purchase')).not.toHaveAttribute('aria-disabled');

    // Change the peril after the quote: the DROUGHT quote no longer prices the form.
    await chooseIn(/coverage peril/i, /Comprehensive/);
    await waitFor(() => expect(screen.queryByRole('button', { name: /proceed to purchase/i })).not.toBeInTheDocument());
    expect(screen.queryByText(/premium breakdown/i)).not.toBeInTheDocument();
    expect(stepButton('Purchase')).toHaveAttribute('aria-disabled', 'true');
    expect(stepButton('Purchase')).toHaveAccessibleDescription('Calculate the premium first');

    fireEvent.click(screen.getByRole('button', { name: /calculate premium/i }));
    fireEvent.click(await screen.findByRole('button', { name: /proceed to purchase/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create policy/i }));
    await screen.findByRole('button', { name: /send payment prompt/i });

    expect(mocks.getPolicyQuote).toHaveBeenCalledTimes(2);
    expect(mocks.getPolicyQuote).toHaveBeenLastCalledWith(expect.objectContaining({ coverageType: 'COMPREHENSIVE' }));
    expect(mocks.purchasePolicy).toHaveBeenCalledTimes(1);
    expect(mocks.purchasePolicy).toHaveBeenCalledWith(expect.objectContaining({ coverageType: 'COMPREHENSIVE', season: 'LRLD' }));
  });

  it('announces the current step and shows why a tapped step is locked', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    const nav = screen.getByRole('navigation', { name: /onboarding progress/i });
    const [live] = within(nav).getAllByRole('status');
    expect(live).toHaveTextContent('Step 1 of 7: Register');

    fireEvent.click(stepButton('Quote'));
    expect(screen.getByTestId('stepper-locked-notice')).toHaveTextContent(
      "Can't open Quote. Register the pastoralist first.",
    );

    await reachHerdStep();
    expect(live).toHaveTextContent('Step 4 of 7: Herd');
    expect(screen.getByTestId('stepper-locked-notice')).toBeEmptyDOMElement();
  });
});
