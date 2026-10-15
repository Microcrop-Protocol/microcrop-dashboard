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

/** …→ plot → walk → review → quote → purchase, landing on the payment step. */
async function reachPaymentStep() {
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
  fireEvent.click(await screen.findByRole('button', { name: /get quote/i }));
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
});
