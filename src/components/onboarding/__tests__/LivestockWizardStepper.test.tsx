/**
 * THE LIVESTOCK WIZARD'S FREELY NAVIGABLE STEPPER — the same contract as the crop wizard's,
 * through the same shared component: every step opens at any time, prerequisites are checked
 * when an action is submitted (no request, one message listing every gap as links), saved
 * records reopen read-only, and nothing before the policy can be submitted a second time.
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

const STEP_TITLES = ['Register', 'Consent', 'Verify', 'Herd', 'Quote', 'Purchase', 'Payment'];

const writes = () => [
  mocks.registerFarmer, mocks.fieldVerifyKyc, mocks.createHerd, mocks.getPolicyQuote,
  mocks.purchasePolicy, mocks.initiatePayment,
];

function gapLinks(container: HTMLElement) {
  return within(container).getAllByRole('button').map((b) => b.textContent);
}

async function fillRegistration() {
  await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ekai' } });
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lokol' } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+254712345678' } });
  fireEvent.change(screen.getByLabelText(/national id/i), { target: { value: '30000001' } });
  fireEvent.change(screen.getByLabelText(/^county/i), { target: { value: 'Turkana' } });
  fireEvent.change(screen.getByLabelText(/^sub-county/i), { target: { value: 'Turkana Central' } });
}

async function fillHerdForm() {
  fireEvent.change(screen.getByLabelText(/herd name/i), { target: { value: 'Main herd' } });
  await waitFor(() => expect(mocks.getActiveInsuranceUnits).toHaveBeenCalled());
  await chooseIn(/coverage region/i, /KE-10/);
  await chooseIn(/livestock type/i, /Cattle/);
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
  await fillHerdForm();
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
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(STEP_TITLES);
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');
  });

  it('opens every step from a fresh wizard, in any order, without crashing', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    for (const title of ['Payment', 'Purchase', 'Herd', 'Consent', 'Quote', 'Verify', 'Register', 'Purchase']) {
      expect(stepButton(title)).not.toHaveAttribute('aria-disabled');
      fireEvent.click(stepButton(title));
      expect(stepButton(title)).toHaveAttribute('aria-current', 'step');
      expect(screen.getByRole('heading', { name: /livestock onboarding/i })).toBeInTheDocument();
    }
    for (const title of STEP_TITLES) expect(stepButton(title)).not.toHaveAccessibleName(/completed/);
    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });

  it('renders the herd, quote and purchase steps with earlier data missing', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    fireEvent.click(stepButton('Herd'));
    expect(screen.getByLabelText(/herd name/i)).toBeInTheDocument();
    fireEvent.click(stepButton('Quote'));
    expect(screen.getByRole('button', { name: /calculate premium/i })).toBeEnabled();
    fireEvent.click(stepButton('Purchase'));
    // It used to render nothing at all here.
    expect(screen.getByText('Confirm Purchase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create policy/i })).toBeEnabled();

    fireEvent.click(stepButton('Payment'));
    const notice = screen.getByTestId('step-missing-notice');
    expect(notice).toHaveTextContent('Before you can collect payment:');
    expect(gapLinks(notice)).toEqual([
      'Register the pastoralist (Register)',
      "Verify the pastoralist's identity (Verify)",
      'Register the herd (Herd)',
      'Calculate the premium (Quote)',
      'Create the policy (Purchase)',
    ]);
    fireEvent.click(within(notice).getByRole('button', { name: /register the herd/i }));
    expect(stepButton('Herd')).toHaveAttribute('aria-current', 'step');
  });

  it('submits with missing prerequisites make no request and list exactly what is missing', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());

    fireEvent.click(stepButton('Quote'));
    fireEvent.click(screen.getByRole('button', { name: /calculate premium/i }));
    let message = await screen.findByTestId('submit-blocked');
    expect(message).toHaveAttribute('role', 'alert');
    expect(message).toHaveTextContent('Before you can get a quote:');
    expect(gapLinks(message)).toEqual([
      'Register the pastoralist (Register)', "Verify the pastoralist's identity (Verify)", 'Register the herd (Herd)',
    ]);

    fireEvent.click(stepButton('Purchase'));
    fireEvent.click(screen.getByRole('button', { name: /create policy/i }));
    message = await screen.findByTestId('submit-blocked');
    expect(gapLinks(message)).toHaveLength(4);
    expect(gapLinks(message).at(-1)).toBe('Calculate the premium (Quote)');

    fireEvent.click(stepButton('Verify'));
    fireEvent.click(screen.getByRole('button', { name: /approve & continue/i }));
    message = await screen.findByTestId('submit-blocked');
    expect(gapLinks(message)).toEqual(['Register the pastoralist (Register)']);
    fireEvent.click(within(message).getByRole('button', { name: /register the pastoralist/i }));
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');

    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });

  it('keeps verification a requirement for the herd', async () => {
    renderWizard();
    await fillRegistration();
    fireEvent.click(screen.getByRole('button', { name: /register pastoralist/i }));
    await screen.findByText(/consent is not enforced/i);

    fireEvent.click(stepButton('Herd'));
    await fillHerdForm();
    fireEvent.click(screen.getByRole('button', { name: /register herd/i }));
    const message = await screen.findByTestId('submit-blocked');
    expect(gapLinks(message)).toEqual(["Verify the pastoralist's identity (Verify)"]);
    expect(mocks.createHerd).not.toHaveBeenCalled();

    fireEvent.click(within(message).getByRole('button', { name: /verify/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve & continue/i }));
    await screen.findByLabelText(/herd name/i);
    expect(screen.getByLabelText(/herd name/i)).toHaveValue('Main herd');
    fireEvent.click(screen.getByRole('button', { name: /register herd/i }));
    await screen.findByRole('button', { name: /calculate premium/i });
    expect(mocks.createHerd).toHaveBeenCalledTimes(1);
  });

  it('lists invalid herd fields alongside the missing steps', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    fireEvent.click(stepButton('Herd'));
    fireEvent.click(screen.getByRole('button', { name: /register herd/i }));
    const message = await screen.findByTestId('submit-blocked');
    expect(message).toHaveTextContent('Complete the highlighted fields on this step');
    expect(gapLinks(message)).toEqual(['Register the pastoralist (Register)', "Verify the pastoralist's identity (Verify)"]);
    expect(mocks.createHerd).not.toHaveBeenCalled();
  });

  it('a double-tapped submit sends one request', async () => {
    renderWizard();
    await fillRegistration();
    const submit = screen.getByRole('button', { name: /register pastoralist/i });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await screen.findByText(/consent is not enforced/i);
    expect(mocks.registerFarmer).toHaveBeenCalledTimes(1);
  });

  it('goes back to a completed step with state intact, and forward again', async () => {
    renderWizard();
    await reachHerdStep();
    fireEvent.change(screen.getByLabelText(/herd name/i), { target: { value: 'Main herd' } });

    fireEvent.click(stepButton('Register'));
    expect(await screen.findByText('Pastoralist Registered')).toBeInTheDocument();
    expect(screen.getByText('Ekai Lokol')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /register pastoralist/i })).not.toBeInTheDocument();
    expect(stepButton('Verify')).toHaveAccessibleName('Verify (completed)');
    expect(stepButton('Herd')).toHaveAccessibleName('Herd');

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

    stepButton('Purchase').focus();
    await user.keyboard('{Enter}');
    expect(stepButton('Purchase')).toHaveAttribute('aria-current', 'step');

    stepButton('Herd').focus();
    await user.keyboard(' ');
    expect(stepButton('Herd')).toHaveAttribute('aria-current', 'step');
  });

  it('drops a quote once the season or peril changes, and Purchase asks for a new one', async () => {
    renderWizard();
    await reachQuoteStep();
    fireEvent.click(screen.getByRole('button', { name: /calculate premium/i }));
    await screen.findByRole('button', { name: /proceed to purchase/i });

    await chooseIn(/coverage peril/i, /Comprehensive/);
    await waitFor(() => expect(screen.queryByRole('button', { name: /proceed to purchase/i })).not.toBeInTheDocument());
    expect(screen.queryByText(/premium breakdown/i)).not.toBeInTheDocument();

    fireEvent.click(stepButton('Purchase'));
    fireEvent.click(screen.getByRole('button', { name: /create policy/i }));
    const message = await screen.findByTestId('submit-blocked');
    expect(gapLinks(message)).toEqual(['Get a new quote — the season or peril changed since the last one (Quote)']);
    expect(mocks.purchasePolicy).not.toHaveBeenCalled();

    fireEvent.click(within(message).getByRole('button', { name: /get a new quote/i }));
    fireEvent.click(screen.getByRole('button', { name: /calculate premium/i }));
    fireEvent.click(await screen.findByRole('button', { name: /proceed to purchase/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create policy/i }));
    await screen.findByRole('button', { name: /send payment prompt/i });

    expect(mocks.getPolicyQuote).toHaveBeenCalledTimes(2);
    expect(mocks.getPolicyQuote).toHaveBeenLastCalledWith(expect.objectContaining({ coverageType: 'COMPREHENSIVE' }));
    expect(mocks.purchasePolicy).toHaveBeenCalledTimes(1);
    expect(mocks.purchasePolicy).toHaveBeenCalledWith(expect.objectContaining({ coverageType: 'COMPREHENSIVE', season: 'LRLD' }));
  });

  it('announces the current step, and pauses navigation while a request is in flight', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    const nav = screen.getByRole('navigation', { name: /onboarding progress/i });
    const [live] = within(nav).getAllByRole('status');
    expect(live).toHaveTextContent('Step 1 of 7: Register');
    fireEvent.click(stepButton('Quote'));
    expect(live).toHaveTextContent('Step 5 of 7: Quote');
    fireEvent.click(stepButton('Register'));

    let resolveRegister: (v: unknown) => void = () => {};
    mocks.registerFarmer.mockReturnValueOnce(new Promise((resolve) => { resolveRegister = resolve; }));
    await fillRegistration();
    fireEvent.click(screen.getByRole('button', { name: /register pastoralist/i }));
    await waitFor(() => expect(stepButton('Herd')).toHaveAttribute('aria-disabled', 'true'));
    fireEvent.click(stepButton('Herd'));
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('stepper-locked-notice')).toHaveTextContent(
      "Can't open Herd yet. Wait for the current request to finish.",
    );

    resolveRegister({
      id: 'farmer-1', firstName: 'Ekai', lastName: 'Lokol', phoneNumber: '+254712345678',
      nationalId: '30000001', county: 'Turkana', kycStatus: 'PENDING',
    });
    await screen.findByText(/consent is not enforced/i);
    expect(live).toHaveTextContent('Step 2 of 7: Consent');
    expect(screen.getByTestId('stepper-locked-notice')).toBeEmptyDOMElement();
  });

  it('survives pressing every action on every step in a scrambled order', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    const actions = /register pastoralist|approve & continue|register herd|calculate premium|create policy|send payment prompt|^continue$|^back$/i;
    let pressed = 0;
    for (const title of ['Purchase', 'Payment', 'Quote', 'Herd', 'Verify', 'Consent', 'Register', 'Purchase', 'Quote']) {
      fireEvent.click(stepButton(title));
      const main = screen.getByRole('heading', { name: /livestock onboarding/i }).parentElement?.parentElement as HTMLElement;
      for (const button of within(main).queryAllByRole('button', { name: actions })) {
        if (!document.body.contains(button)) continue;
        fireEvent.click(button);
        pressed += 1;
        await waitFor(() => expect(screen.getByRole('navigation', { name: /onboarding progress/i })).toBeInTheDocument());
      }
    }
    expect(pressed).toBeGreaterThan(5);
    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });
});
