/**
 * THE CROP WIZARD'S NAVIGABLE STEPPER. A completed step opens again with the wizard's state
 * intact; a future step opens only when everything it reads already exists, and a locked one
 * says why; and once the policy is bought, no earlier step can submit again — every one of them
 * would otherwise create a second farmer, plot or policy.
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
  fireEvent.change(screen.getByLabelText(/plot name/i), { target: { value: 'North' } });
  fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '-0.3' } });
  fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '36.1' } });
  fireEvent.change(screen.getByLabelText(/acreage/i), { target: { value: '2' } });
  const field = screen.getByText(/crop type/i).closest('div') as HTMLElement;
  fireEvent.click(within(field).getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: /Maize/ }));
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
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Register', 'Consent', 'Verify', 'Plot', 'Boundary', 'Review', 'Quote', 'Purchase', 'Payment',
    ]);
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');
    expect(buttons.filter((b) => b.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('keeps a locked future step shut and says why', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());

    const consent = stepButton('Consent');
    expect(consent).toHaveAttribute('aria-disabled', 'true');
    expect(consent).toHaveAccessibleDescription('Register the farmer first');
    expect(consent).toHaveAttribute('title', 'Register the farmer first');
    expect(stepButton('Payment')).toHaveAccessibleDescription('Purchase the policy first');

    fireEvent.click(consent);
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /register farmer/i })).toBeInTheDocument();
  });

  it('names the earliest missing prerequisite on a locked step', async () => {
    renderWizard();
    await reachPlotStep();
    expect(stepButton('Boundary')).toHaveAccessibleDescription('Create the plot first');
    expect(stepButton('Quote')).toHaveAccessibleDescription('Create the plot first');
    expect(stepButton('Purchase')).toHaveAccessibleDescription('Create the plot first');
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

    // KYC is reachable and already done: it says so instead of verifying again.
    fireEvent.click(stepButton('Verify'));
    expect(await screen.findByText(/identity has been verified/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm identity verification/i })).not.toBeInTheDocument();

    // The plot step is reachable from behind it, and the half-filled form kept its value.
    fireEvent.click(stepButton('Plot'));
    expect(screen.getByLabelText(/plot name/i)).toHaveValue('North');

    expect(mocks.registerFarmer).toHaveBeenCalledTimes(1);
    expect(mocks.fieldVerifyKyc).toHaveBeenCalledTimes(1);
  });

  it('opens a reachable future step', async () => {
    renderWizard();
    await reachPaymentStep();
    fireEvent.click(stepButton('Register'));
    await screen.findByText('Farmer Registered');

    // Every step after it has its prerequisites, so the payment step can be jumped straight to.
    expect(stepButton('Payment')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(stepButton('Payment'));
    expect(stepButton('Payment')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /send .* request/i })).toBeInTheDocument();
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

    const walk = stepButton('Boundary');
    expect(walk).toHaveAttribute('aria-disabled', 'true');
    expect(walk).toHaveAccessibleDescription(/policy has been purchased/i);
    fireEvent.click(walk);
    expect(stepButton('Review')).toHaveAttribute('aria-current', 'step');

    fireEvent.click(stepButton('Plot'));
    expect(await screen.findByText('Plot Created')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create plot/i })).not.toBeInTheDocument();

    fireEvent.click(stepButton('Register'));
    expect(await screen.findByText('Farmer Registered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /register farmer/i })).not.toBeInTheDocument();

    expect(mocks.registerFarmer).toHaveBeenCalledTimes(1);
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

    // A locked step stays focusable so its reason can be read, but does not open.
    const quote = stepButton('Quote');
    quote.focus();
    expect(quote).toHaveFocus();
    await user.keyboard(' ');
    expect(stepButton('Register')).toHaveAttribute('aria-current', 'step');

    stepButton('Plot').focus();
    await user.keyboard(' ');
    expect(stepButton('Plot')).toHaveAttribute('aria-current', 'step');
  });
  it('drops a quote once the coverage form changes, and buys only what was quoted', async () => {
    renderWizard();
    await reachQuoteStep();
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    await screen.findByRole('button', { name: /continue to purchase/i });
    expect(stepButton('Purchase')).not.toHaveAttribute('aria-disabled');

    // Edit the sum insured after the quote: the 10,000 quote no longer prices the form.
    fireEvent.change(screen.getByLabelText(/sum insured/i), { target: { value: '50000' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /continue to purchase/i })).not.toBeInTheDocument());
    expect(screen.queryByText(/KES 550/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get quote/i })).toBeInTheDocument();
    expect(stepButton('Purchase')).toHaveAttribute('aria-disabled', 'true');
    expect(stepButton('Purchase')).toHaveAccessibleDescription('Get a premium quote first');

    // Re-quote on the new value, then buy: the purchase sends what that quote priced.
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
    expect(mocks.purchasePolicy).toHaveBeenCalledWith(expect.objectContaining({ sumInsured: 50000 }));
  });

  it('shows why a step is locked when it is tapped, for screens without tooltips', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^county/i)).toBeInTheDocument());
    const notice = screen.getByTestId('stepper-locked-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toBeEmptyDOMElement();

    fireEvent.click(stepButton('Purchase'));
    expect(notice).toHaveTextContent("Can't open Purchase. Register the farmer first.");

    // Moving on clears it.
    await reachPlotStep();
    expect(notice).toBeEmptyDOMElement();
  });

  it('announces the current step in a live region', async () => {
    renderWizard();
    const nav = screen.getByRole('navigation', { name: /onboarding progress/i });
    const live = within(nav).getAllByRole('status')[0];
    expect(live).toHaveTextContent('Step 1 of 9: Register');
    await reachPlotStep();
    fireEvent.click(stepButton('Register'));
    expect(live).toHaveTextContent('Step 1 of 9: Register');
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
    expect(screen.getByTestId('stepper-locked-notice')).toHaveTextContent(/Wait for the current request to finish/);

    resolveQuote({ sumInsured: 10000, coverageType: 'DROUGHT', durationDays: 90, premium: 500, platformFee: 50, totalCost: 550 });
    await screen.findByRole('button', { name: /continue to purchase/i });
    await waitFor(() => expect(stepButton('Register')).not.toHaveAttribute('aria-disabled'));
  });

  it("pauses navigation while the boundary walk's save is in flight", async () => {
    renderWizard();
    await reachPlotStep();
    fireEvent.change(screen.getByLabelText(/plot name/i), { target: { value: 'North' } });
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '-0.3' } });
    fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '36.1' } });
    fireEvent.change(screen.getByLabelText(/acreage/i), { target: { value: '2' } });
    const field = screen.getByText(/crop type/i).closest('div') as HTMLElement;
    fireEvent.click(within(field).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: /Maize/ }));
    fireEvent.click(screen.getByRole('button', { name: /create plot/i }));

    fireEvent.click(await screen.findByRole('button', { name: 'Start saving walk' }));
    expect(stepButton('Plot')).toHaveAttribute('aria-disabled', 'true');
    expect(stepButton('Plot')).toHaveAccessibleDescription('Wait for the current request to finish');
  });

  it('keeps the saved boundary when the agent chooses to re-walk', async () => {
    renderWizard();
    await reachQuoteStep();
    fireEvent.click(stepButton('Review'));
    fireEvent.click(await screen.findByRole('button', { name: /re-walk boundary/i }));
    expect(stepButton('Boundary')).toHaveAttribute('aria-current', 'step');

    // The server still holds the first walk, so Review and Quote stay open (and ticked).
    expect(stepButton('Review')).toHaveAccessibleName('Review (completed)');
    expect(stepButton('Quote')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(stepButton('Quote'));
    expect(await screen.findByRole('button', { name: /get quote/i })).toBeInTheDocument();
  });
});
