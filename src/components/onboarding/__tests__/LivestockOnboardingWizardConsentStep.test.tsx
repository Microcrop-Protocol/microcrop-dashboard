/**
 * A pastoralist is a farmer under the Data Protection Act — same personal data, same
 * obligation. This is the second onboarding path into the same Farmer table, so if it
 * skipped consent, anyone onboarded through the livestock product would never have
 * been asked at all.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  getActiveInsuranceUnits: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { getActiveInsuranceUnits: mocks.getActiveInsuranceUnits },
}));

vi.mock('@/lib/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('@/components/farmers/FarmerConsentPanel', () => ({
  FarmerConsentPanel: ({ farmerId }: { farmerId: string }) => (
    <div data-testid="consent-panel">consent panel for {farmerId}</div>
  ),
}));

import { LivestockOnboardingWizard } from '../LivestockOnboardingWizard';

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LivestockOnboardingWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getActiveInsuranceUnits.mockReset().mockResolvedValue([]);
});

describe('LivestockOnboardingWizard consent step', () => {
  it('lists Consent as a step', () => {
    renderWizard();
    expect(screen.getByText('Consent')).toBeInTheDocument();
  });

  it('places consent second, straight after registration', () => {
    renderWizard();
    const stepper = screen.getByRole('navigation', { name: /onboarding progress/i });
    const titles = Array.from(stepper.querySelectorAll('li span')).map((el) => el.textContent);
    expect(titles).toEqual([
      'Register', 'Consent', 'Verify', 'Herd', 'Quote', 'Purchase', 'Payment',
    ]);
  });
});
