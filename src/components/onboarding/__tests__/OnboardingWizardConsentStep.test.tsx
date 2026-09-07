/**
 * The wizard's consent step, as a step: that it exists, that it lands between
 * registration and identity verification, and that it does not pretend to gate
 * anything the backend does not actually gate.
 *
 * The consent panel itself is stubbed here — its behaviour is covered in
 * components/farmers/__tests__/FarmerConsentPanel.test.tsx. What this file pins is
 * the WIRING, which is the part that was missing: the backend has had a full consent
 * API for a while and no screen in this dashboard called it.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  registerFarmer: vi.fn(),
  fieldVerifyKyc: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    registerFarmer: mocks.registerFarmer,
    fieldVerifyKyc: mocks.fieldVerifyKyc,
  },
}));

vi.mock('@/lib/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

// Stubbed: this test is about the step's place in the flow, not the panel's contents.
vi.mock('@/components/farmers/FarmerConsentPanel', () => ({
  FarmerConsentPanel: ({ farmerId }: { farmerId: string }) => (
    <div data-testid="consent-panel">consent panel for {farmerId}</div>
  ),
}));

// mapbox-gl needs a real WebGL context; the boundary steps are never reached here,
// but the module is imported eagerly by the wizard.
vi.mock('@/components/onboarding/BoundaryReviewMap', () => ({
  BoundaryReviewMap: () => <div />,
}));
vi.mock('@/components/onboarding/BoundaryWalkStep', () => ({
  BoundaryWalkStep: () => <div />,
}));

import { OnboardingWizard } from '../OnboardingWizard';

const FARMER = {
  id: 'farmer-1',
  organizationId: 'org-1',
  firstName: 'Wanjiku',
  lastName: 'Mwangi',
  phoneNumber: '+254700000000',
  nationalId: '12345678',
  county: 'Nakuru',
  kycStatus: 'PENDING',
};

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OnboardingWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function registerAFarmer() {
  fireEvent.change(screen.getByPlaceholderText('Jane'), { target: { value: 'Wanjiku' } });
  fireEvent.change(screen.getByPlaceholderText('Mwangi'), { target: { value: 'Mwangi' } });
  fireEvent.change(screen.getByPlaceholderText('+254712345678'), {
    target: { value: '+254700000000' },
  });
  fireEvent.change(screen.getByPlaceholderText('30000001'), { target: { value: '12345678' } });
  fireEvent.change(screen.getByPlaceholderText('Kiambu'), { target: { value: 'Nakuru' } });
  fireEvent.change(screen.getByPlaceholderText('Kikuyu'), { target: { value: 'Njoro' } });
  fireEvent.click(screen.getByRole('button', { name: /register farmer/i }));
  await waitFor(() => expect(mocks.registerFarmer).toHaveBeenCalled());
}

beforeEach(() => {
  mocks.registerFarmer.mockReset().mockResolvedValue(FARMER);
  mocks.fieldVerifyKyc.mockReset().mockResolvedValue({ id: 'farmer-1', kycStatus: 'APPROVED' });
});

describe('OnboardingWizard consent step', () => {
  it('lists Consent as a step in the stepper', () => {
    renderWizard();
    expect(screen.getByText('Consent')).toBeInTheDocument();
  });

  it('reports the step count including the consent step', () => {
    renderWizard();
    expect(screen.getByText(/Step 1 of 9: Register/)).toBeInTheDocument();
  });

  /**
   * Consent comes before the plot walk, the GPS boundary and the KYC check, all of
   * which collect more personal data about the same person.
   */
  it('goes to consent immediately after registration, before identity verification', async () => {
    renderWizard();
    await registerAFarmer();

    expect(await screen.findByText(/Step 2 of 9: Consent/)).toBeInTheDocument();
    expect(screen.getByTestId('consent-panel')).toHaveTextContent('farmer-1');
    expect(screen.queryByRole('button', { name: /confirm identity verification/i })).not.toBeInTheDocument();
  });

  /**
   * The backend reports `enforcedOnPurchase: false` and refuses to capture against
   * its unapproved placeholder documents in production. A wizard that blocked here
   * would both lie about the product and be unusable in prod on day one.
   */
  it('does not block onboarding on consent, and says why', async () => {
    renderWizard();
    await registerAFarmer();

    await screen.findByTestId('consent-panel');
    expect(screen.getByText(/not enforced on purchase/i)).toBeInTheDocument();

    const continueButton = screen.getByRole('button', { name: /^continue$/i });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    expect(await screen.findByText(/Step 3 of 9: Verify/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm identity verification/i })).toBeInTheDocument();
  });

  it('keeps the rest of the flow reachable after consent', async () => {
    renderWizard();
    await registerAFarmer();

    fireEvent.click(await screen.findByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirm identity verification/i }));

    await waitFor(() => expect(mocks.fieldVerifyKyc).toHaveBeenCalledWith('farmer-1'));
    expect(await screen.findByText(/Step 4 of 9: Plot/)).toBeInTheDocument();
  });
});
