/**
 * The field-onboarding wizard for a GHANAIAN organization: Ghanaian examples on the form, and a
 * crop picker drawn from Ghana's catalogue — its pilot crops selectable and badged, its
 * coming-soon crops SELECTABLE for the plot (the backend registers a plot for any listed crop) but
 * labelled "Coming soon — cannot be insured yet", and nothing from the old global list (tea,
 * cassava, green grams).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GH_CATALOGUE } from '@/test/catalogue-fixtures';

const mocks = vi.hoisted(() => ({
  registerFarmer: vi.fn(),
  fieldVerifyKyc: vi.fn(),
  getCatalogue: vi.fn(),
  getMyOrganization: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: mocks }));
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock('@/stores/authStore', () => {
  const state = { user: { id: 'u1', role: 'ORG_FIELD_AGENT', organizationId: 'org-gh' } };
  const useAuthStore = (selector?: (s: unknown) => unknown) => (selector ? selector(state) : state);
  return { useAuthStore };
});
vi.mock('@/components/farmers/FarmerConsentPanel', () => ({ FarmerConsentPanel: () => <div /> }));
vi.mock('@/components/onboarding/BoundaryReviewMap', () => ({ BoundaryReviewMap: () => <div /> }));
vi.mock('@/components/onboarding/BoundaryWalkStep', () => ({ BoundaryWalkStep: () => <div /> }));

import { OnboardingWizard } from '../OnboardingWizard';

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OnboardingWizard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.getCatalogue.mockReset().mockResolvedValue({ markets: [GH_CATALOGUE] });
  mocks.getMyOrganization.mockReset().mockResolvedValue({ id: 'org-gh', countryCode: 'GH' });
  mocks.registerFarmer.mockReset().mockResolvedValue({
    id: 'farmer-1', firstName: 'Ama', lastName: 'Mensah', phoneNumber: '+233241234567',
    nationalId: 'GHA-1', county: 'Ashanti', kycStatus: 'PENDING',
  });
  mocks.fieldVerifyKyc.mockReset().mockResolvedValue({ id: 'farmer-1', kycStatus: 'APPROVED' });
});

describe('OnboardingWizard in Ghana', () => {
  it('shows Ghanaian examples, not Kenyan ones', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/last name/i)).toHaveAttribute('placeholder', 'Mensah'));
    expect(screen.getByLabelText(/^region/i)).toHaveAttribute('placeholder', 'Ashanti');
    expect(document.body.innerHTML).not.toMatch(/Mwangi|Kinoo|Nairobi|\+254/);
  });

  it("offers Ghana's crops on the plot step", async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/^region/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ama' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Mensah' } });
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '+233241234567' } });
    fireEvent.change(screen.getByLabelText(/national id/i), { target: { value: 'GHA-0001' } });
    fireEvent.change(screen.getByLabelText(/^region/i), { target: { value: 'Ashanti' } });
    fireEvent.change(screen.getByLabelText(/^district/i), { target: { value: 'Kumasi' } });
    fireEvent.click(screen.getByRole('button', { name: /register farmer/i }));
    await waitFor(() => expect(mocks.registerFarmer).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirm identity verification/i }));

    const cropLabel = await screen.findByText(/crop type/i);
    const field = cropLabel.closest('div') as HTMLElement;
    fireEvent.click(within(field).getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    const names = options.map((o) => o.textContent ?? '');
    expect(names.some((n) => n.startsWith('Soybean'))).toBe(true);
    expect(names.some((n) => /Tea|Cassava|Green grams|Banana/.test(n))).toBe(false);

    const soybean = screen.getByRole('option', { name: /Soybean/ });
    expect(soybean).toHaveTextContent('Pilot');
    expect(soybean).not.toHaveAttribute('aria-disabled', 'true');
    const cowpea = screen.getByRole('option', { name: /Cowpea/ });
    expect(cowpea).not.toHaveAttribute('aria-disabled', 'true');
    expect(cowpea).toHaveTextContent('Coming soon — cannot be insured yet');
  });
});
