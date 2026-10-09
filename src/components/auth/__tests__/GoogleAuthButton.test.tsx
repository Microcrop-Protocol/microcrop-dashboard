/**
 * THE PROVIDER BUTTON MUST NOT LOOK LIVE WHILE THE BACKEND HAS NO ROUTE.
 *
 * There is no Google OAuth in microcrop-backend — no /auth/google, no callback, no client
 * id. The failure mode this file exists to prevent is the easy one: a styled button that
 * navigates nowhere, or navigates to a 404, and leaves the partner unable to tell a broken
 * button from a broken account.
 *
 * Two properties are pinned, and they pull in opposite directions, which is why both are
 * tested rather than just the obvious one:
 *
 *   1. It is INERT and says so on screen — not a tooltip, which a touch user never sees.
 *   2. It is still REACHABLE BY KEYBOARD. The naive fix is the `disabled` attribute, which
 *      drops the control out of the tab order; a screen reader user would then never learn
 *      the option exists or why it is off. aria-disabled keeps it announced.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { GoogleAuthButton } from '../GoogleAuthButton';

afterEach(() => {
  vi.unstubAllEnvs();
});

const googleButton = (name: RegExp = /continue with google/i) =>
  screen.getByRole('button', { name });

describe('GoogleAuthButton while the backend has no OAuth route', () => {
  it('renders a real <button>, never a div dressed as one', () => {
    render(<GoogleAuthButton />);
    expect(googleButton().tagName).toBe('BUTTON');
  });

  it('marks itself unavailable with aria-disabled rather than the disabled attribute', () => {
    render(<GoogleAuthButton />);
    const button = googleButton();

    expect(button).toHaveAttribute('aria-disabled', 'true');
    // The distinction that matters: `disabled` would remove it from the tab order.
    expect(button).not.toBeDisabled();
  });

  it('stays focusable so a keyboard user can reach the explanation', () => {
    render(<GoogleAuthButton />);
    const button = googleButton();

    button.focus();
    expect(button).toHaveFocus();
    // Nothing has quietly pulled it out of the tab order by another route.
    expect(button).not.toHaveAttribute('tabindex', '-1');
  });

  it('shows a visible reason and ties it to the button with aria-describedby', () => {
    render(<GoogleAuthButton />);
    const describedBy = googleButton().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const explanation = document.getElementById(describedBy as string);
    expect(explanation).toBeInTheDocument();
    expect(explanation).toHaveTextContent(/not available yet/i);
    // Visible text, not an sr-only aside — a sighted user must see why it is dimmed too.
    expect(explanation).not.toHaveClass('sr-only');
  });

  it('does not navigate when clicked', () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...original,
        get href() {
          return '';
        },
        set href(value: string) {
          assign(value);
        },
      },
    });

    render(<GoogleAuthButton />);
    fireEvent.click(googleButton());

    expect(assign).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('honours a custom label, for the sign-up variant', () => {
    render(<GoogleAuthButton label="Sign up with Google" />);
    expect(googleButton(/sign up with google/i)).toBeInTheDocument();
  });
});

describe('GoogleAuthButton once the backend ships the route', () => {
  it('becomes a live control when the flag is on', () => {
    vi.stubEnv('VITE_GOOGLE_AUTH_ENABLED', 'true');
    render(<GoogleAuthButton />);

    expect(googleButton()).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByText(/not available yet/i)).not.toBeInTheDocument();
  });

  it('stays inert for any value other than an explicit "true"', () => {
    // Guards against a deploy that sets the var to "1" or "false" and silently half-enables
    // a button whose backend still does not exist.
    for (const value of ['false', '1', 'yes', '']) {
      vi.stubEnv('VITE_GOOGLE_AUTH_ENABLED', value);
      const { unmount } = render(<GoogleAuthButton />);
      expect(googleButton()).toHaveAttribute('aria-disabled', 'true');
      unmount();
    }
  });
});
