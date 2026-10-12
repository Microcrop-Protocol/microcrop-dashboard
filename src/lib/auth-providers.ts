/**
 * THIRD-PARTY SIGN-IN PROVIDERS — the single source of truth for whether one is live.
 *
 * The auth pages offer "Continue with Google" above the email form. As of this change the
 * BACKEND DOES NOT IMPLEMENT IT. There is no /auth/google route, no provider column on the
 * user, no callback handler and no client id — `grep -ri google microcrop-backend` returns
 * nothing. A button that opens a consent screen and then lands on a 404, or worse appears to
 * do nothing at all, is a support ticket and a lost signup; the user cannot tell a broken
 * button from a broken account.
 *
 * So the button ships VISIBLE BUT INERT, with the reason stated on screen. Visible, because
 * the control is part of the agreed design and hiding it would hide the roadmap from the
 * founder reviewing this page. Inert and labelled, because the one thing we must not do is
 * ship a control that looks live and is not.
 *
 * TO TURN IT ON, all of the following must be true, in this order:
 *   1. the backend exposes the OAuth start + callback routes and issues the same token pair
 *      that POST /auth/login returns today;
 *   2. VITE_GOOGLE_AUTH_ENABLED is set to "true" at build time;
 *   3. `startGoogleSignIn` below is pointed at the real start route.
 * Until step 1 lands, do not flip step 2 — the flag exists to keep the switch in one place,
 * not to make the button look alive early.
 */

export type AuthProviderState =
  | { enabled: true }
  | { enabled: false; reason: string };

/**
 * Whether Google sign-in is actually usable.
 *
 * Defaults to disabled. The env flag alone is deliberately the ONLY input: there is no
 * capability probe against the API, because a probe that fails open would re-create exactly
 * the silent-failure button this module exists to prevent.
 */
export function googleAuthState(): AuthProviderState {
  const flag = import.meta.env.VITE_GOOGLE_AUTH_ENABLED;
  if (typeof flag === 'string' && flag.trim().toLowerCase() === 'true') {
    return { enabled: true };
  }
  return {
    enabled: false,
    reason: 'Google sign-in is not available yet. Use your email and password.',
  };
}
