/**
 * Create account, as a two-step email-first form.
 *
 * WHAT IS PINNED HERE, in the order the risks matter:
 *
 *   KYB STAYS POST-SIGNUP, and has moved FURTHER out. This page must not grow a document
 *   upload or a verification gate, and it no longer asks for the two KYB data it used to:
 *   the company registration number and the organization type. Both are collected in
 *   Settings -> Verification, next to the certificate that proves them, and
 *   `kyb.service.submitOrgKyb` refuses a submission while the registration number is null —
 *   so deferring them costs no assurance. A test asserts they are ABSENT, because
 *   re-adding either is the regression.
 *
 *   THE COUNTRY IS ASKED, AND IS NOT DEFAULTED. It picks the currency, the premium bounds,
 *   the payment provider and the KYB document set. It was never sent, so the backend's
 *   `.default('KE')` made every self-signup organization Kenyan and a Ghanaian partner could
 *   not sign up correctly. A pre-selected Kenya would reproduce that while making it look
 *   like the partner chose it, so the picker starts empty and the field is required.
 *
 *   THE PHONE IS NORMALISED AGAINST THE CHOSEN MARKET, not against Kenya.
 *
 * Plus the state the two-step split introduced: the email collected on step one has to
 * survive into the submitted payload, and focus has to follow the step change.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  registerOrganization: vi.fn(),
  storeLogin: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: { registerOrganization: mocks.registerOrganization } }));
vi.mock('@/lib/notify', () => ({
  notifySuccess: mocks.notifySuccess,
  notifyError: mocks.notifyError,
}));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ login: mocks.storeLogin }) }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

import RegisterOrganizationPage from '../RegisterOrganizationPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterOrganizationPage />
    </MemoryRouter>,
  );
}

function completeEmailStep(email = 'admin@acme.coop') {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  return screen.findByLabelText(/organization name/i);
}

/**
 * Pick the country of operation.
 *
 * It is a Radix Select — a button and a portalled listbox, not a <select> — so it has to be
 * opened and chosen from. It is also REQUIRED, and the schema's password-match check hangs
 * off a `.refine()` on the whole object, which zod only evaluates once the base shape
 * parses. Skip the country and you get no "passwords do not match" error, which looks like a
 * broken validation rule rather than a half-filled form.
 */
async function chooseCountry(label = 'Kenya') {
  fireEvent.click(screen.getByRole('combobox', { name: /country of operation/i }));
  fireEvent.click(await screen.findByRole('option', { name: label }));
}

/** Fill everything the schema requires, except the country — see chooseCountry. */
function fillDetails(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    'organization name': 'Acme Cooperative',
    'first name': 'Amina',
    'last name': 'Otieno',
    '^password$': 'Sup3rSecret!',
    'confirm password': 'Sup3rSecret!',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(new RegExp(label, 'i')), { target: { value } });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.registerOrganization.mockResolvedValue({
    user: { id: 'u1', role: 'ORG_ADMIN', firstName: 'Amina', lastName: 'Otieno' },
    organization: { id: 'o1' },
    tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1000 },
  });
});

describe('step one — email', () => {
  it('mirrors sign-in: one email field under a "Create account" h1', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/organization name/i)).not.toBeInTheDocument();
  });

  it('points back at sign-in', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('will not advance on a malformed address', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email address/i);
    expect(screen.queryByLabelText(/organization name/i)).not.toBeInTheDocument();
  });

  it('does not create anything before the details are given', async () => {
    renderPage();
    await completeEmailStep();
    expect(mocks.registerOrganization).not.toHaveBeenCalled();
  });
});

describe('step two — details', () => {
  it('moves focus into the step rather than stranding the user', async () => {
    renderPage();
    const orgName = await completeEmailStep();
    await waitFor(() => expect(orgName).toHaveFocus());
  });

  it('shows the email from step one and submits it with the rest', async () => {
    renderPage();
    await completeEmailStep('admin@acme.coop');
    expect(screen.getByText('admin@acme.coop')).toBeInTheDocument();

    fillDetails();
    await chooseCountry();

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => expect(mocks.registerOrganization).toHaveBeenCalled());
    expect(mocks.registerOrganization.mock.calls[0][0]).toMatchObject({
      email: 'admin@acme.coop',
      organizationName: 'Acme Cooperative',
      countryCode: 'KE',
      firstName: 'Amina',
      lastName: 'Otieno',
      password: 'Sup3rSecret!',
    });
  });

  it('sends the chosen country, which is what picks the currency and the KYB documents', async () => {
    renderPage();
    await completeEmailStep();
    fillDetails();
    await chooseCountry('Ghana');

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => expect(mocks.registerOrganization).toHaveBeenCalled());
    expect(mocks.registerOrganization.mock.calls[0][0].countryCode).toBe('GH');
  });

  it('offers only the OPEN markets — a hidden market is not a signup choice', async () => {
    renderPage();
    await completeEmailStep();
    fireEvent.click(screen.getByRole('combobox', { name: /country of operation/i }));
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Kenya', 'Ghana']);
  });

  it('will not submit without a country, rather than defaulting to Kenya', async () => {
    renderPage();
    await completeEmailStep();
    fillDetails();

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => expect(mocks.notifyError).not.toHaveBeenCalled());
    expect(mocks.registerOrganization).not.toHaveBeenCalled();
    expect(await screen.findByText(/select the country/i)).toBeInTheDocument();
  });

  it('normalises a local phone number against the CHOSEN market, not against Kenya', async () => {
    renderPage();
    await completeEmailStep();
    fillDetails();
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '0241234567' } });
    await chooseCountry('Ghana');

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => expect(mocks.registerOrganization).toHaveBeenCalled());
    // The old normaliser was hardcoded `+254`, so this exact input produced +254241234567 —
    // a syntactically valid Kenyan number belonging to nobody.
    expect(mocks.registerOrganization.mock.calls[0][0].phone).toBe('+233241234567');
  });

  it('still normalises a Kenyan local number when Kenya is chosen', async () => {
    renderPage();
    await completeEmailStep();
    fillDetails();
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '0712345678' } });
    await chooseCountry('Kenya');

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => expect(mocks.registerOrganization).toHaveBeenCalled());
    expect(mocks.registerOrganization.mock.calls[0][0].phone).toBe('+254712345678');
  });

  it('rejects a number from another market than the one chosen', async () => {
    renderPage();
    await completeEmailStep();
    fillDetails();
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+233241234567' } });
    await chooseCountry('Kenya');

    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    // The backend's service layer refuses this after the fact; catching it here is what stops
    // a Kenyan organization storing a Ghanaian number.
    expect(await screen.findByText(/kenya number/i)).toBeInTheDocument();
    expect(mocks.registerOrganization).not.toHaveBeenCalled();
  });

  it('hands the new account to KYB rather than verifying anything here', async () => {
    renderPage();
    await completeEmailStep();
    fillDetails();
    await chooseCountry();
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/org/settings/verification', { replace: true }),
    );
    expect(mocks.storeLogin).toHaveBeenCalled();
  });

  it('does not collect KYB documents at signup', async () => {
    renderPage();
    await completeEmailStep();

    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/upload/i)).not.toBeInTheDocument();
  });

  /**
   * The registration number and the organization type MOVED to KYB. Asserting their absence is
   * the regression test: both are easy to "restore" as a convenience, and doing so puts a
   * unique-constrained field with a hard 409 and no self-service remedy back on the first screen
   * a prospective partner sees.
   */
  it('does not ask for the company registration number or the organization type', async () => {
    renderPage();
    await completeEmailStep();

    expect(screen.queryByLabelText(/registration number/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^type$/i })).not.toBeInTheDocument();
  });

  it('says where the deferred KYB details are collected instead', async () => {
    renderPage();
    await completeEmailStep();
    expect(screen.getByText(/settings/i)).toBeInTheDocument();
    expect(screen.getByText(/registration number/i)).toBeInTheDocument();
  });

  it('surfaces a mismatched password confirmation against the right field', async () => {
    renderPage();
    await completeEmailStep();
    fillDetails({ 'confirm password': 'Different1!' });
    await chooseCountry();
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    const confirm = screen.getByLabelText(/confirm password/i);
    await waitFor(() => expect(confirm).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(mocks.registerOrganization).not.toHaveBeenCalled();
  });

  it('reports a failed signup without navigating', async () => {
    mocks.registerOrganization.mockRejectedValue(new Error('duplicate'));
    renderPage();
    await completeEmailStep();
    fillDetails();
    await chooseCountry();
    fireEvent.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('goes back to the email step', async () => {
    renderPage();
    await completeEmailStep();
    fireEvent.click(screen.getByRole('button', { name: /use a different email/i }));

    const email = await screen.findByLabelText(/email address/i);
    await waitFor(() => expect(email).toHaveFocus());
  });

  it('binds every text label to its input', async () => {
    renderPage();
    await completeEmailStep();

    for (const label of [
      /organization name/i,
      // The level-1 administrative division. Its LABEL is per-market and falls back to the
      // default market's wording before a country is chosen, so it is matched on that.
      /^county$/i,
      /first name/i,
      /last name/i,
      /phone/i,
      /^password$/i,
      /confirm password/i,
    ]) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('id');
      expect(
        document.querySelector(`label[for="${input.getAttribute('id')}"]`),
      ).toBeInTheDocument();
    }
  });
});
