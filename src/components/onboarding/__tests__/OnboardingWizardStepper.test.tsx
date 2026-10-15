/**
 * THE CROP WIZARD'S FREELY NAVIGABLE STEPPER. Every step opens at any time, in any order, and
 * renders without crashing. What a step needs is checked when its action is SUBMITTED: with
 * anything missing, no request is made and one message lists every gap, each a link to the step
 * that fills it. Saved records still open read-only, and once the policy is bought no earlier
 * step can submit again — every one of them would otherwise create a second farmer, plot or policy.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KE_CATALOGUE } from '@/test/catalogue-fixtures';
import type { GpsTrackResponse } from '@/types';

const mocks = vi.hoisted(() => ({
  registerFarmer: vi.fn(),
  fieldVerifyKyc: vi.fn(),
  createPlot: vi.fn(),
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
vi.mock('@/components/onboarding/BoundaryReviewMap', () => ({ BoundaryReviewMap: () => <div /> }));
vi.mock('@/components/onboarding/BoundaryWalkStep', () => ({
  BoundaryWalkStep: ({ onComplete, onSubmittingChange }: {
    onComplete: (r: GpsTrackResponse) => void;
    onSubmittingChange?: (pending: boolean) => void;
  }) => (
    <>
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
      <button type="button" onClick={() => onSubmittingChange?.(true)}>Start saving walk</button>
    </>
  ),
}));

import { OnboardingWizard } from '../OnboardingWizard';

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OnboardingWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The stepper button for `title`. */
function stepButton(title: string) {
  const nav = screen.getByRole('navigation', { name: /onboarding progress/i });
  return within(nav).getByRole('button', { name: new RegExp(`^${title}( \\(completed\\))?$`) });
}

const STEP_TITLES = ['Register', 'Consent', 'Verify', 'Plot', 'Boundary', 'Review', 'Quote', 'Purchase', 'Payment'];

/** Every API call that writes, or prices. None may happen while a prerequisite is missing. */
const writes = () => [
  mocks.registerFarmer, mocks.fieldVerifyKyc, mocks.createPlot, mocks.getPolicyQuote,
  mocks.purchasePolicy, mocks.initiatePayment,
];

/** The refusal shown on a submit with gaps. */
async function blockedMessage() {
  return screen.findByTestId('submit-blocked');
}

/** The links in a missing-prerequisites message, by accessible name. */
function gapLinks(container: HTMLElement) {
  return within(container).getAllByRole('button').map((b) => b.textContent);
}

async function fillRegistration() {
  await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Wanjiku' } });
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Mwangi' } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+254712345678' } });
  fireEvent.change(screen.getByLabelText(/national id/i), { target: { value: 'KE-00001' } });
  fireEvent.change(screen.getByLabelText(/^county/i), { target: { value: 'Nakuru' } });
  fireEvent.change(screen.getByLabelText(/^sub-county/i), { target: { value: 'Njoro' } });
}

async function fillPlotForm() {
  fireEvent.change(screen.getByLabelText(/plot name/i), { target: { value: 'North' } });
  fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '-0.3' } });
  fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '36.1' } });
  fireEvent.change(screen.getByLabelText(/acreage/i), { target: { value: '2' } });
  const field = screen.getByText(/crop type/i).closest('div') as HTMLElement;
  fireEvent.click(within(field).getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: /Maize/ }));
}

/** Register → consent → KYC, landing on the plot step. */
async function reachPlotStep() {
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
  await screen.findByLabelText(/plot name/i);
}

/** …→ plot → walk → review, landing on the quote step with no quote yet. */
async function reachQuoteStep() {
  await reachPlotStep();
  await fillPlotForm();
  fireEvent.click(screen.getByRole('button', { name: /create plot/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Finish walk' }));
  fireEvent.click(await screen.findByRole('button', { name: /confirm boundary/i }));
  await screen.findByRole('button', { name: /get quote/i });
}

/** …→ quote → purchase, landing on the payment step. */
async function reachPaymentStep() {
  await reachQuoteStep();
  fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
  fireEvent.click(await screen.findByRole('button', { name: /continue to purchase/i }));
  fireEvent.click(await screen.findByRole('button', { name: /purchase policy/i }));
  await screen.findByRole('button', { name: /send .* request/i });
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
    id: 'plot-1', farmerId: 'farmer-1', name: data.name, cropType: data.cropType, acreage: 2, latitude: -0.3, longitude: 36.1,
  }));
  mocks.getPolicyQuote.mockReset().mockResolvedValue({
    sumInsured: 10000, coverageType: 'DROUGHT', durationDays: 90, premium: 500, platformFee: 50, totalCost: 550, riskScore: 0.1,
  });
  mocks.purchasePolicy.mockReset().mockResolvedValue({
    policy: { id: 'policy-1', policyNumber: 'POL-0001' },
    paymentInstructions: { amount: 550 },
  });
  mocks.initiatePayment.mockReset();
  mocks.getPaymentStatusByRef.mockReset();
});


describe('OnboardingWizard stepper', () => {
  it('renders every step as a button and marks the current one', async () => {
    renderWizard();
    const nav = screen.getByRole('navigation', { name: /onboarding progress/i });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(STEP_TITLES);
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');
    expect(buttons.filter((b) => b.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('opens every step from a fresh wizard, in any order, without crashing', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    const order = ['Payment', 'Consent', 'Review', 'Purchase', 'Boundary', 'Quote', 'Verify', 'Plot', 'Register', 'Payment', 'Quote'];
    for (const title of order) {
      const button = stepButton(title);
      expect(button).not.toHaveAttribute('aria-disabled');
      fireEvent.click(button);
      expect(stepButton(title)).toHaveAttribute('aria-current', 'step');
      // Still mounted: the stepper and a step card are both on screen.
      expect(screen.getByRole('heading', { name: /field onboarding/i })).toBeInTheDocument();
    }
    // Nothing is ticked, because nothing exists yet.
    for (const title of STEP_TITLES) expect(stepButton(title)).not.toHaveAccessibleName(/completed/);
    expect(screen.getByTestId('stepper-locked-notice')).toBeEmptyDOMElement();
    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });

  it('each step renders its form even with earlier data missing', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    fireEvent.click(stepButton('Plot'));
    expect(screen.getByLabelText(/plot name/i)).toBeInTheDocument();
    fireEvent.click(stepButton('Quote'));
    expect(screen.getByLabelText(/sum insured/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get quote/i })).toBeEnabled();
    fireEvent.click(stepButton('Verify'));
    expect(screen.getByRole('button', { name: /confirm identity verification/i })).toBeEnabled();
    fireEvent.click(stepButton('Purchase'));
    expect(screen.getByRole('button', { name: /purchase policy/i })).toBeEnabled();
  });

  it('says what a step needs when it has nothing to show without earlier data', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());

    fireEvent.click(stepButton('Boundary'));
    let notice = screen.getByTestId('step-missing-notice');
    expect(notice).toHaveTextContent('Before you can walk the boundary:');
    expect(gapLinks(notice)).toEqual([
      'Register the farmer (Register)', "Verify the farmer's identity (Verify)", 'Create the plot (Plot)',
    ]);
    expect(screen.queryByRole('button', { name: 'Finish walk' })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Payment'));
    notice = screen.getByTestId('step-missing-notice');
    expect(notice).toHaveTextContent('Before you can collect payment:');
    expect(gapLinks(notice)).toHaveLength(6);
    expect(gapLinks(notice).at(-1)).toBe('Purchase the policy (Purchase)');
    expect(screen.queryByRole('button', { name: /send .* request/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Review'));
    expect(screen.getByTestId('step-missing-notice')).toHaveTextContent('Walk the plot boundary (Boundary)');

    fireEvent.click(stepButton('Consent'));
    notice = screen.getByTestId('step-missing-notice');
    expect(gapLinks(notice)).toEqual(['Register the farmer (Register)']);
    // Consent never blocks, so Continue still moves on.
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(stepButton('Verify')).toHaveAttribute('aria-current', 'step');

    // The links navigate.
    fireEvent.click(stepButton('Boundary'));
    fireEvent.click(within(screen.getByTestId('step-missing-notice')).getByRole('button', { name: /create the plot/i }));
    expect(stepButton('Plot')).toHaveAttribute('aria-current', 'step');
  });

  it('a quote with missing prerequisites makes no request and lists exactly what is missing', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    fireEvent.click(stepButton('Quote'));
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));

    const message = await blockedMessage();
    expect(message).toHaveAttribute('role', 'alert');
    expect(message).toHaveTextContent('Before you can get a quote:');
    expect(gapLinks(message)).toEqual([
      'Register the farmer (Register)',
      "Verify the farmer's identity (Verify)",
      'Create the plot (Plot)',
      'Walk the plot boundary (Boundary)',
    ]);
    expect(mocks.getPolicyQuote).not.toHaveBeenCalled();

    // Each item is a link to the step that fixes it.
    fireEvent.click(within(message).getByRole('button', { name: /verify the farmer's identity/i }));
    expect(stepButton('Verify')).toHaveAttribute('aria-current', 'step');
    // The message belongs to the step it was raised on.
    expect(screen.queryByTestId('submit-blocked')).not.toBeInTheDocument();
  });

  it('each primary action checks its prerequisites at submit', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());

    fireEvent.click(stepButton('Verify'));
    fireEvent.click(screen.getByRole('button', { name: /confirm identity verification/i }));
    expect(gapLinks(await blockedMessage())).toEqual(['Register the farmer (Register)']);

    fireEvent.click(stepButton('Plot'));
    await fillPlotForm();
    fireEvent.click(screen.getByRole('button', { name: /create plot/i }));
    const plotMessage = await blockedMessage();
    expect(plotMessage).toHaveTextContent('Before you can create the plot:');
    expect(gapLinks(plotMessage)).toEqual(['Register the farmer (Register)', "Verify the farmer's identity (Verify)"]);

    fireEvent.click(stepButton('Purchase'));
    fireEvent.click(screen.getByRole('button', { name: /purchase policy/i }));
    expect(gapLinks(await blockedMessage())).toEqual([
      'Register the farmer (Register)',
      "Verify the farmer's identity (Verify)",
      'Create the plot (Plot)',
      'Walk the plot boundary (Boundary)',
      'Get a premium quote (Quote)',
    ]);

    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
  });

  it("lists the step's own invalid fields alongside the missing steps", async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    fireEvent.click(stepButton('Plot'));
    fireEvent.click(screen.getByRole('button', { name: /create plot/i }));
    const message = await blockedMessage();
    expect(message).toHaveTextContent('Complete the highlighted fields on this step');
    expect(gapLinks(message)).toEqual(['Register the farmer (Register)', "Verify the farmer's identity (Verify)"]);

    // Registration has no earlier steps: only its own fields are listed.
    fireEvent.click(stepButton('Register'));
    fireEvent.click(screen.getByRole('button', { name: /register farmer/i }));
    const own = await blockedMessage();
    expect(own).toHaveTextContent('Before you can register the farmer:');
    expect(own).toHaveTextContent('Complete the highlighted fields on this step');
    expect(within(own).queryAllByRole('button')).toHaveLength(0);
    expect(mocks.registerFarmer).not.toHaveBeenCalled();
    expect(mocks.createPlot).not.toHaveBeenCalled();
  });

  it('keeps verification a requirement for the plot', async () => {
    renderWizard();
    await fillRegistration();
    fireEvent.click(screen.getByRole('button', { name: /register farmer/i }));
    await screen.findByText(/consent is not enforced/i);

    // Skip verification and go straight to the plot.
    fireEvent.click(stepButton('Plot'));
    await fillPlotForm();
    fireEvent.click(screen.getByRole('button', { name: /create plot/i }));
    const message = await blockedMessage();
    expect(gapLinks(message)).toEqual(["Verify the farmer's identity (Verify)"]);
    expect(mocks.createPlot).not.toHaveBeenCalled();

    // Verify, come back: the half-filled form is intact and now submits.
    fireEvent.click(within(message).getByRole('button', { name: /verify/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm identity verification/i }));
    await screen.findByLabelText(/plot name/i);
    expect(screen.getByLabelText(/plot name/i)).toHaveValue('North');
    fireEvent.click(screen.getByRole('button', { name: /create plot/i }));
    await screen.findByRole('button', { name: 'Finish walk' });
    expect(mocks.createPlot).toHaveBeenCalledTimes(1);
  });

  it('keeps the boundary walk a requirement for the quote', async () => {
    renderWizard();
    await reachPlotStep();
    await fillPlotForm();
    fireEvent.click(screen.getByRole('button', { name: /create plot/i }));
    await screen.findByRole('button', { name: 'Finish walk' });

    fireEvent.click(stepButton('Quote'));
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    expect(gapLinks(await blockedMessage())).toEqual(['Walk the plot boundary (Boundary)']);
    expect(mocks.getPolicyQuote).not.toHaveBeenCalled();
  });

  it('a double-tapped submit sends one request', async () => {
    renderWizard();
    await fillRegistration();
    const submit = screen.getByRole('button', { name: /register farmer/i });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await screen.findByText(/consent is not enforced/i);
    expect(mocks.registerFarmer).toHaveBeenCalledTimes(1);
  });

  it('goes back to a completed step with the wizard state intact, and forward again', async () => {
    renderWizard();
    await reachPlotStep();
    fireEvent.change(screen.getByLabelText(/plot name/i), { target: { value: 'North' } });

    // Back to registration: the saved farmer, read-only — no form that would register them twice.
    fireEvent.click(stepButton('Register'));
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');
    expect(await screen.findByText('Farmer Registered')).toBeInTheDocument();
    expect(screen.getByText('Wanjiku Mwangi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /register farmer/i })).not.toBeInTheDocument();
    expect(stepButton('Consent')).toHaveAccessibleName('Consent (completed)');

    // KYC is already done: it says so instead of verifying again.
    fireEvent.click(stepButton('Verify'));
    expect(await screen.findByText(/identity has been verified/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm identity verification/i })).not.toBeInTheDocument();

    // The half-filled plot form kept its value.
    fireEvent.click(stepButton('Plot'));
    expect(screen.getByLabelText(/plot name/i)).toHaveValue('North');

    expect(mocks.registerFarmer).toHaveBeenCalledTimes(1);
    expect(mocks.fieldVerifyKyc).toHaveBeenCalledTimes(1);
  });

  it('jumps straight to any step once everything exists', async () => {
    renderWizard();
    await reachPaymentStep();
    fireEvent.click(stepButton('Register'));
    await screen.findByText('Farmer Registered');

    fireEvent.click(stepButton('Payment'));
    expect(stepButton('Payment')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /send .* request/i })).toBeInTheDocument();
    for (const title of ['Register', 'Consent', 'Verify', 'Plot', 'Boundary', 'Review', 'Quote', 'Purchase']) {
      expect(stepButton(title)).toHaveAccessibleName(`${title} (completed)`);
    }
  });

  it('after purchase, no earlier step can submit again', async () => {
    renderWizard();
    await reachPaymentStep();

    fireEvent.click(stepButton('Purchase'));
    expect(await screen.findByRole('note')).toHaveTextContent(/Policy POL-0001 has been purchased/);
    expect(screen.queryByRole('button', { name: /purchase policy/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Quote'));
    expect(await screen.findByText(/quote can no longer be changed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get quote|recalculate/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Review'));
    expect(await screen.findByRole('note')).toHaveTextContent(/purchased on this boundary/i);
    expect(screen.queryByRole('button', { name: /re-walk boundary/i })).not.toBeInTheDocument();

    // The walk step opens, but offers no walk: it would rewrite the bought plot's boundary.
    fireEvent.click(stepButton('Boundary'));
    expect(stepButton('Boundary')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/boundary can no longer be re-walked/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish walk' })).not.toBeInTheDocument();
    expect(stepButton('Review')).toHaveAccessibleName('Review (completed)');

    fireEvent.click(stepButton('Plot'));
    expect(await screen.findByText('Plot Created')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create plot/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Verify'));
    expect(screen.queryByRole('button', { name: /confirm identity verification/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Register'));
    expect(await screen.findByText('Farmer Registered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /register farmer/i })).not.toBeInTheDocument();

    expect(mocks.registerFarmer).toHaveBeenCalledTimes(1);
    expect(mocks.fieldVerifyKyc).toHaveBeenCalledTimes(1);
    expect(mocks.createPlot).toHaveBeenCalledTimes(1);
    expect(mocks.purchasePolicy).toHaveBeenCalledTimes(1);
  });

  it('is operable from the keyboard', async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachPlotStep();

    stepButton('Register').focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Farmer Registered')).toBeInTheDocument();

    // A step whose prerequisites are missing still opens.
    stepButton('Quote').focus();
    await user.keyboard(' ');
    expect(stepButton('Quote')).toHaveAttribute('aria-current', 'step');

    stepButton('Plot').focus();
    await user.keyboard('{Enter}');
    expect(stepButton('Plot')).toHaveAttribute('aria-current', 'step');
  });

  it('drops a quote once the coverage form changes, and Purchase asks for a new one', async () => {
    renderWizard();
    await reachQuoteStep();
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    await screen.findByRole('button', { name: /continue to purchase/i });
    expect(stepButton('Quote')).not.toHaveAccessibleName(/completed/); // current step

    // Edit the sum insured after the quote: the 10,000 quote no longer prices the form.
    fireEvent.change(screen.getByLabelText(/sum insured/i), { target: { value: '50000' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /continue to purchase/i })).not.toBeInTheDocument());
    expect(screen.queryByText(/KES 550/)).not.toBeInTheDocument();

    // Purchase opens, but refuses to buy the stale quote and says why.
    fireEvent.click(stepButton('Purchase'));
    expect(stepButton('Quote')).toHaveAccessibleName('Quote');
    fireEvent.click(screen.getByRole('button', { name: /purchase policy/i }));
    const message = await blockedMessage();
    expect(gapLinks(message)).toEqual(['Get a new quote — the coverage changed since the last one (Quote)']);
    expect(mocks.purchasePolicy).not.toHaveBeenCalled();

    // The link goes back to the quote; re-quote on the new value, then buy what that priced.
    fireEvent.click(within(message).getByRole('button', { name: /get a new quote/i }));
    expect(stepButton('Quote')).toHaveAttribute('aria-current', 'step');
    mocks.getPolicyQuote.mockResolvedValueOnce({
      sumInsured: 50000, coverageType: 'DROUGHT', durationDays: 90, premium: 2500, platformFee: 250, totalCost: 2750, riskScore: 0.1,
    });
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    fireEvent.click(await screen.findByRole('button', { name: /continue to purchase/i }));
    expect(await screen.findByText(/Sum Insured: KES 50,000/)).toBeInTheDocument();
    expect(screen.getByText(/KES 2,750/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /purchase policy/i }));
    await screen.findByRole('button', { name: /send .* request/i });

    expect(mocks.getPolicyQuote).toHaveBeenCalledTimes(2);
    expect(mocks.getPolicyQuote).toHaveBeenLastCalledWith(expect.objectContaining({ sumInsured: 50000 }));
    expect(mocks.purchasePolicy).toHaveBeenCalledTimes(1);
    expect(mocks.purchasePolicy).toHaveBeenCalledWith(expect.objectContaining({ sumInsured: 50000 }));
  });

  it('a new boundary drops the quote it was priced on', async () => {
    renderWizard();
    await reachQuoteStep();
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    await screen.findByRole('button', { name: /continue to purchase/i });

    fireEvent.click(stepButton('Boundary'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish walk' }));
    fireEvent.click(stepButton('Purchase'));
    fireEvent.click(screen.getByRole('button', { name: /purchase policy/i }));
    expect(gapLinks(await blockedMessage())).toEqual(['Get a premium quote (Quote)']);
    expect(mocks.purchasePolicy).not.toHaveBeenCalled();
  });

  it('announces the current step in a live region', async () => {
    renderWizard();
    const nav = screen.getByRole('navigation', { name: /onboarding progress/i });
    const live = within(nav).getAllByRole('status')[0];
    expect(live).toHaveTextContent('Step 1 of 9: Register');
    fireEvent.click(stepButton('Quote'));
    expect(live).toHaveTextContent('Step 7 of 9: Quote');
    fireEvent.click(stepButton('Plot'));
    expect(live).toHaveTextContent('Step 4 of 9: Plot');
  });

  it('pauses navigation while a request is in flight', async () => {
    renderWizard();
    await reachQuoteStep();
    let resolveQuote: (v: unknown) => void = () => {};
    mocks.getPolicyQuote.mockReturnValueOnce(new Promise((resolve) => { resolveQuote = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));

    await waitFor(() => expect(stepButton('Register')).toHaveAttribute('aria-disabled', 'true'));
    expect(stepButton('Register')).toHaveAccessibleDescription('Wait for the current request to finish');
    // A request in flight does not take the ticks off the steps behind it.
    expect(stepButton('Register')).toHaveAccessibleName('Register (completed)');
    fireEvent.click(stepButton('Register'));
    expect(stepButton('Quote')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('stepper-locked-notice')).toHaveTextContent(
      "Can't open Register yet. Wait for the current request to finish.",
    );

    resolveQuote({ sumInsured: 10000, coverageType: 'DROUGHT', durationDays: 90, premium: 500, platformFee: 50, totalCost: 550 });
    await screen.findByRole('button', { name: /continue to purchase/i });
    await waitFor(() => expect(stepButton('Register')).not.toHaveAttribute('aria-disabled'));
    expect(screen.getByTestId('stepper-locked-notice')).toBeEmptyDOMElement();
  });

  it("pauses navigation while the boundary walk's save is in flight", async () => {
    renderWizard();
    await reachPlotStep();
    await fillPlotForm();
    fireEvent.click(screen.getByRole('button', { name: /create plot/i }));

    fireEvent.click(await screen.findByRole('button', { name: 'Start saving walk' }));
    expect(stepButton('Plot')).toHaveAttribute('aria-disabled', 'true');
    expect(stepButton('Plot')).toHaveAccessibleDescription('Wait for the current request to finish');
    fireEvent.click(stepButton('Plot'));
    expect(stepButton('Boundary')).toHaveAttribute('aria-current', 'step');
  });

  it('keeps the saved boundary when the agent chooses to re-walk', async () => {
    renderWizard();
    await reachQuoteStep();
    fireEvent.click(stepButton('Review'));
    fireEvent.click(await screen.findByRole('button', { name: /re-walk boundary/i }));
    expect(stepButton('Boundary')).toHaveAttribute('aria-current', 'step');

    // The server still holds the first walk, so Review stays ticked and the quote can be had.
    expect(stepButton('Review')).toHaveAccessibleName('Review (completed)');
    fireEvent.click(stepButton('Quote'));
    fireEvent.click(await screen.findByRole('button', { name: /get quote/i }));
    await screen.findByRole('button', { name: /continue to purchase/i });
    expect(mocks.getPolicyQuote).toHaveBeenCalledTimes(1);
  });

  it('survives pressing every action on every step in a scrambled order', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    const actions = /register farmer|confirm identity verification|create plot|get quote|purchase policy|send .* request|^continue$|confirm boundary|re-walk boundary/i;
    let pressed = 0;
    for (const title of ['Purchase', 'Payment', 'Quote', 'Review', 'Boundary', 'Verify', 'Plot', 'Consent', 'Register', 'Purchase']) {
      fireEvent.click(stepButton(title));
      const card = screen.getByRole('heading', { name: /field onboarding/i }).parentElement?.parentElement as HTMLElement;
      for (const button of within(card).queryAllByRole('button', { name: actions })) {
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
