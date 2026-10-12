/**
 * Sign in, as a two-step email-first form.
 *
 * The reskin introduced a step that did not exist before, and with it the two ways this
 * page could quietly become worse than the single-screen form it replaced:
 *
 *   ACCOUNT ENUMERATION. "Continue" is the obvious place to ask the backend whether the
 *   address is known, and a "no account with that email" message is the obvious thing to
 *   show. That turns the public sign-in page into a membership oracle for our customer
 *   list. Step one must stay entirely local.
 *
 *   LOST FOCUS. Advancing unmounts the button the user just pressed. Without deliberate
 *   focus management a keyboard or screen reader user is dumped back on <body> and has to
 *   find the new field by hunting.
 *
 * Also pinned: the password still reaches the unchanged POST /auth/login, labels are bound
 * to their inputs, and the footer does not link a Terms page that does not exist.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  storeLogin: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: { login: mocks.login } }));
vi.mock('@/lib/notify', () => ({
  notifySuccess: mocks.notifySuccess,
  notifyError: mocks.notifyError,
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ login: mocks.storeLogin }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

import LoginPage from '../LoginPage';

const ORG_USER = {
  id: 'u1',
  role: 'ORG_ADMIN',
  firstName: 'Amina',
  lastName: 'Otieno',
};

function renderPage(route = '/login') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LoginPage />
    </MemoryRouter>,
  );
}

/** Fill the email field and press Continue. */
function completeEmailStep(email = 'partner@acme.co') {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.login.mockResolvedValue({
    user: ORG_USER,
    tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1000 },
  });
});

describe('step one — email', () => {
  it('shows only the email field, with the heading as the page h1', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });

  it('binds the label to the input rather than just placing text above it', () => {
    renderPage();
    const input = screen.getByLabelText(/email address/i);

    expect(input).toHaveAttribute('id');
    expect(document.querySelector(`label[for="${input.getAttribute('id')}"]`)).toBeInTheDocument();
  });

  it('does not call the API — step one must not be an account-enumeration oracle', async () => {
    renderPage();
    completeEmailStep();

    await screen.findByLabelText(/^password$/i);
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('refuses to advance on a malformed address, and says so accessibly', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/valid email address/i);
    // Still on step one.
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();

    const input = screen.getByLabelText(/email address/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('advances on Enter in the field, not only on the button', async () => {
    renderPage();
    const input = screen.getByLabelText(/email address/i);
    fireEvent.change(input, { target: { value: 'partner@acme.co' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByLabelText(/^password$/i)).toBeInTheDocument();
  });
});

describe('step two — password', () => {
  it('moves focus to the password field so keyboard users are not stranded', async () => {
    renderPage();
    completeEmailStep();

    const password = await screen.findByLabelText(/^password$/i);
    await waitFor(() => expect(password).toHaveFocus());
  });

  it('keeps the email visible and carries it to the submit', async () => {
    renderPage();
    completeEmailStep('partner@acme.co');
    await screen.findByLabelText(/^password$/i);

    expect(screen.getByText('partner@acme.co')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Sup3rSecret!' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith('partner@acme.co', 'Sup3rSecret!'),
    );
  });

  it('exposes the email to password managers as a username field', async () => {
    renderPage();
    completeEmailStep('partner@acme.co');
    await screen.findByLabelText(/^password$/i);

    const username = document.querySelector('input[autocomplete="username"]');
    expect(username).toHaveValue('partner@acme.co');
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  it('toggles password visibility through a real button that reports its state', async () => {
    renderPage();
    completeEmailStep();
    const password = await screen.findByLabelText(/^password$/i);
    expect(password).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: /show password/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('goes back to the email step and restores focus there', async () => {
    renderPage();
    completeEmailStep();
    await screen.findByLabelText(/^password$/i);

    fireEvent.click(screen.getByRole('button', { name: /use a different email/i }));

    const email = await screen.findByLabelText(/email address/i);
    await waitFor(() => expect(email).toHaveFocus());
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });

  it('keeps the forgot-password route reachable', async () => {
    renderPage();
    completeEmailStep();
    await screen.findByLabelText(/^password$/i);

    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('reports a rejected sign-in without revealing which half was wrong', async () => {
    mocks.login.mockRejectedValue(new Error('nope'));
    renderPage();
    completeEmailStep();
    await screen.findByLabelText(/^password$/i);

    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    expect(mocks.notifyError.mock.calls[0][1]).toMatch(/invalid email or password/i);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('routes an org user to the org dashboard on success', async () => {
    renderPage();
    completeEmailStep();
    await screen.findByLabelText(/^password$/i);

    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Sup3rSecret!' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/org/dashboard'));
    expect(mocks.storeLogin).toHaveBeenCalled();
  });

  it('routes a platform admin to the platform dashboard', async () => {
    mocks.login.mockResolvedValue({
      user: { ...ORG_USER, role: 'PLATFORM_ADMIN' },
      tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1000 },
    });
    renderPage();
    completeEmailStep();
    await screen.findByLabelText(/^password$/i);

    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'Sup3rSecret!' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/platform/dashboard'));
  });
});

describe('page furniture', () => {
  it('links to sign-up', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute(
      'href',
      '/register-organization',
    );
  });

  it('surfaces the deactivated-organization reason from the query string', () => {
    renderPage('/login?reason=deactivated');
    expect(screen.getByText(/organization deactivated/i)).toBeInTheDocument();
  });

  it('links Privacy but renders Terms as plain text while no terms page exists', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      'https://microcrop.app/privacy',
    );
    // Present as text, absent as a link — a dead /terms link is the thing being prevented.
    expect(screen.getByText('Terms')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Terms' })).not.toBeInTheDocument();
  });

  it('offers Google sign-in only as a labelled, inert control', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /continue with google/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
