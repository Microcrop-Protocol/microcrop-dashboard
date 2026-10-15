import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens, UserRole } from '@/types';
import { apiClient } from '@/lib/api/client';

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
// Floor for the silent-refresh delay so an unexpectedly short-lived token can't hot-loop.
const MIN_REFRESH_DELAY_MS = 10 * 1000;

// Absolute last-resort lifetime used ONLY when a token carries no decodable
// `exp` claim and the server provided no expiry. Real expiry is always derived
// from the token itself (see resolveExpiresAt) — this is not a normal path.
const FALLBACK_LIFETIME_MS = 60 * 60 * 1000;

/**
 * Decode the `exp` claim (seconds since epoch) from a JWT access token and
 * return it as an epoch-milliseconds timestamp. Returns null for non-JWT or
 * malformed tokens so callers can fall back to a server-provided value.
 *
 * Note: this only *reads* the (unverified) payload to schedule client-side
 * refreshes. The token's authenticity is still enforced server-side on every
 * request — we never trust this decode for authorization decisions.
 */
function decodeJwtExpiry(accessToken?: string | null): number | null {
  if (!accessToken) return null;
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp * 1000; // exp is in seconds; store as ms
    }
  } catch {
    // Malformed token / payload — fall through to caller's fallback.
  }
  return null;
}

/**
 * Derive the real expiry for a set of tokens: prefer the JWT `exp` claim, then
 * a server-provided expiry, and only as a last resort a fixed lifetime.
 *
 * A server expiry in the PAST is honored, not replaced: isTokenExpired() must
 * report an expired token as expired. The immediate refresh this triggers can't
 * hot-loop — scheduleTokenRefresh floors the delay at MIN_REFRESH_DELAY_MS.
 */
function resolveExpiresAt(accessToken: string, serverExpiresAt?: number): number {
  const jwtExp = decodeJwtExpiry(accessToken);
  if (jwtExp) return jwtExp;
  if (typeof serverExpiresAt === 'number' && Number.isFinite(serverExpiresAt) && serverExpiresAt > 0) {
    return serverExpiresAt;
  }
  return Date.now() + FALLBACK_LIFETIME_MS;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Set while the session is still valid but a refresh could not be completed for a
   * transient reason (rate limit, network, 5xx). Not persisted. Cleared on the next
   * successful refresh. See refreshAccessToken for the policy.
   */
  refreshError: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  refreshAccessToken: () => Promise<void>;

  // Helpers
  isPlatformAdmin: () => boolean;
  isOrgAdmin: () => boolean;
  isOrgStaff: () => boolean;
  hasRole: (role: UserRole) => boolean;
  isTokenExpired: () => boolean;
  isTokenNearExpiry: () => boolean;
}

const STORAGE_KEY = 'microcrop-auth';
// Web Locks name shared by every tab on this origin, so only one tab rotates at a time.
const REFRESH_LOCK = 'microcrop-auth-refresh';

/**
 * What a refresh attempt ended in.
 * - refreshed:   new tokens are in memory and storage.
 * - loggedOut:   the server rejected the refresh token (or there was none); the session is over.
 * - unavailable: the server could not be asked (rate limit, network, 5xx). The session is kept
 *                and a retry is scheduled. Never treated as a logout.
 */
type RefreshOutcome = 'refreshed' | 'loggedOut' | 'unavailable';

let refreshPromise: Promise<RefreshOutcome> | null = null;

// Timer that proactively refreshes the access token shortly before it expires,
// so an active session is renewed silently instead of being force-logged-out.
// Also used to retry after a transient refresh failure.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

// Consecutive transient refresh failures, for the retry backoff. Reset on success.
let transientFailures = 0;
const RETRY_BASE_MS = 2 * 1000;
const RETRY_MAX_MS = 60 * 1000;
// A server-supplied retryAfter is honoured up to this cap (the auth window is 5 minutes).
const RETRY_AFTER_CAP_MS = 5 * 60 * 1000;

function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * (Re)arm the silent-refresh timer to fire TOKEN_REFRESH_BUFFER_MS before the
 * current token's real expiry. If the token is already inside the buffer window
 * the delay is floored at MIN_REFRESH_DELAY_MS (not 0) so an abnormally
 * short-lived token can't drive a hot refresh loop.
 */
function scheduleSilentRefresh(getState: () => AuthState): void {
  clearRefreshTimer();
  if (typeof window === 'undefined') return;

  const tokens = getState().tokens;
  if (!tokens?.refreshToken || !tokens.expiresAt) return;

  const delay = Math.max(MIN_REFRESH_DELAY_MS, tokens.expiresAt - TOKEN_REFRESH_BUFFER_MS - Date.now());
  refreshTimer = setTimeout(() => {
    void getState().refreshAccessToken();
  }, delay);
}

/** Arm a retry after a transient failure: the server's retryAfter if it gave one, else backoff. */
function scheduleRetry(getState: () => AuthState, err: unknown): void {
  clearRefreshTimer();
  if (typeof window === 'undefined') return;

  transientFailures += 1;
  const retryAfterSec = Number(
    (err as { context?: { retryAfter?: unknown } } | null)?.context?.retryAfter
  );
  const delay =
    Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? Math.min(retryAfterSec * 1000, RETRY_AFTER_CAP_MS)
      : Math.min(RETRY_BASE_MS * 2 ** (transientFailures - 1), RETRY_MAX_MS);
  refreshTimer = setTimeout(() => {
    void getState().refreshAccessToken();
  }, delay);
}

/**
 * Only an explicit rejection of the refresh token ends the session. The backend answers 401
 * for an invalid, expired or revoked refresh token (and 400 for a malformed request). Anything
 * else, including 429 from the rate limiter, a network failure (status 0) and 5xx, says nothing
 * about the token, so it must not log the user out.
 *
 * 403 is deliberately NOT a rejection: the backend never sends it from /auth/refresh-token, but
 * a Cloudflare WAF block or challenge page does. Likewise any non-JSON body (INVALID_RESPONSE)
 * came from something in front of the API, not from the API judging the token.
 *
 * Duck-typed on `status` rather than `instanceof ApiError` so it also holds for errors raised
 * by a mocked client.
 */
function isSessionRejected(err: unknown): boolean {
  const e = err as { status?: unknown; code?: unknown } | null;
  if (e?.code === 'INVALID_RESPONSE') return false;
  return e?.status === 400 || e?.status === 401;
}

/**
 * The refresh token as stored in localStorage right now, which another tab may have rotated
 * since this tab loaded. `null` means storage says the user is logged out; `undefined` means
 * storage could not be read, and the caller falls back to the in-memory token.
 */
function readStoredRefreshToken(): string | null | undefined {
  const stored = readStoredAuth();
  return stored === undefined ? undefined : stored.refreshToken;
}

/**
 * The persisted session: its refresh token (`null` = signed out) and the id of the user it
 * belongs to. `undefined` when storage could not be read.
 */
function readStoredAuth(): { refreshToken: string | null; userId: string | null } | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { refreshToken: null, userId: null };
    const parsed = JSON.parse(raw) as {
      state?: { tokens?: { refreshToken?: unknown } | null; user?: { id?: unknown } | null };
    };
    if (!parsed?.state) return undefined;
    const token = parsed.state.tokens?.refreshToken;
    const userId = parsed.state.user?.id;
    return {
      refreshToken: typeof token === 'string' && token ? token : null,
      userId: typeof userId === 'string' && userId ? userId : null,
    };
  } catch {
    return undefined;
  }
}

/**
 * Run `fn` while holding a lock shared by all tabs, when the browser supports Web Locks.
 * Without it the storage re-read in runRefresh still picks up most cross-tab rotations; the
 * remaining race is two tabs refreshing in the same few hundred milliseconds.
 */
async function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK, fn) as Promise<T>;
  }
  return fn();
}

function redirectToLogin(): void {
  window.location.href = '/login';
}

/**
 * Exchange the refresh token for a new pair. Deduplicated within the tab (StrictMode double
 * mounts, the silent-refresh timer, rehydrate and every 401 retry share one request) and
 * serialized across tabs by a Web Lock. Inside the lock the refresh token is re-read from
 * storage, so a token another tab already rotated is used instead of the stale one in memory,
 * which the backend has deleted and would answer with 401.
 */
function runRefresh(
  get: () => AuthState,
  set: (partial: Partial<AuthState>) => void
): Promise<RefreshOutcome> {
  if (refreshPromise) return refreshPromise;

  const promise = (async (): Promise<RefreshOutcome> => {
    try {
      return await withCrossTabLock(async () => {
        const stored = readStoredRefreshToken();
        const refreshToken = stored === undefined ? get().tokens?.refreshToken : stored;
        if (!refreshToken) {
          // Nothing to refresh with: never signed in, or another tab signed out.
          const wasAuthenticated = get().isAuthenticated;
          get().logout();
          if (wasAuthenticated && stored === null) redirectToLogin();
          return 'loggedOut';
        }

        try {
          const result = await apiClient.refreshToken(refreshToken);
          const newTokens: AuthTokens = {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            // Drive expiry from the freshly issued token (JWT `exp`), not a
            // hardcoded lifetime, so the next silent refresh is timed correctly.
            expiresAt: resolveExpiresAt(
              result.accessToken,
              (result as { expiresAt?: number }).expiresAt
            ),
          };
          apiClient.setAccessToken(newTokens.accessToken);
          // Written to storage synchronously by persist, before the lock is released, so the
          // next tab to take the lock reads the new refresh token.
          set({ tokens: newTokens, refreshError: null });
          transientFailures = 0;
          // Arm the next silent refresh ahead of the new expiry.
          scheduleSilentRefresh(get);
          return 'refreshed';
        } catch (err) {
          if (isSessionRejected(err)) {
            // The refresh token is invalid, expired or revoked. We never silently extend a
            // session past this.
            get().logout();
            redirectToLogin();
            return 'loggedOut';
          }
          // Transient: keep the session (and whatever access token is still in memory) and
          // retry. The refresh token is valid for days; losing the session over a 429 or a
          // network blip was the "logged out on refresh" bug.
          set({
            refreshError:
              err instanceof Error && err.message ? err.message : 'Could not reach the server.',
          });
          scheduleRetry(get, err);
          return 'unavailable';
        }
      });
    } finally {
      refreshPromise = null;
      apiClient.setAuthGate(null);
    }
  })();

  refreshPromise = promise;
  // Hold API requests until this refresh settles, so a request fired while the token is being
  // replaced (above all, during the refresh that follows a page reload, when there is no access
  // token at all yet) goes out with the new token instead of none, 401s and logs the user out.
  apiClient.setAuthGate(promise);
  return promise;
}

// Wire up 401 handler — reached only once a refresh-and-retry has failed (or there was no
// session to refresh): log out and go to the login page.
apiClient.onUnauthorized(() => {
  const { logout } = useAuthStore.getState();
  logout();
  window.location.href = '/login';
});

// Wire up the refresh-and-retry path: a 401 from an API call first tries one (shared)
// refresh, and the request is retried with the new token. Resolves to null when the session
// is over, so the client falls through to onUnauthorized; throws when the server could not be
// reached, so the client surfaces the error without logging out.
apiClient.onRefreshNeeded(async () => {
  if (!refreshPromise && transientFailures > 0 && refreshTimer) {
    // The last refresh failed transiently and a retry is already scheduled (honouring the
    // server's retryAfter). Don't jump the queue with another one.
    throw new Error('Session refresh is temporarily unavailable.');
  }
  const outcome = await runRefresh(useAuthStore.getState, useAuthStore.setState);
  if (outcome === 'refreshed') return apiClient.getAccessToken();
  if (outcome === 'loggedOut') return null;
  throw new Error('Session refresh is temporarily unavailable.');
});

// Wire up org deactivated handler — logout with reason so login page can show message
apiClient.onOrgDeactivated(() => {
  const { logout } = useAuthStore.getState();
  logout();
  window.location.href = '/login?reason=deactivated';
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,
      refreshError: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setTokens: (tokens) => {
        apiClient.setAccessToken(tokens?.accessToken || null);
        if (!tokens) {
          clearRefreshTimer();
          set({ tokens: null });
          return;
        }
        // Authoritatively derive expiry from the token itself.
        const normalized: AuthTokens = {
          ...tokens,
          expiresAt: resolveExpiresAt(tokens.accessToken, tokens.expiresAt),
        };
        set({ tokens: normalized });
        scheduleSilentRefresh(get);
      },

      login: (user, tokens) => {
        apiClient.setAccessToken(tokens.accessToken);
        // Ignore any hardcoded caller-supplied lifetime; use the real one.
        const normalized: AuthTokens = {
          ...tokens,
          expiresAt: resolveExpiresAt(tokens.accessToken, tokens.expiresAt),
        };
        set({
          user,
          tokens: normalized,
          isAuthenticated: true,
          isLoading: false,
          refreshError: null,
        });
        transientFailures = 0;
        scheduleSilentRefresh(get);
      },

      logout: () => {
        clearRefreshTimer();
        apiClient.setAccessToken(null);
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          refreshError: null,
        });
        transientFailures = 0;
      },

      setLoading: (isLoading) => set({ isLoading }),

      /**
       * Refresh policy:
       * - success: new tokens, next silent refresh armed.
       * - 401/400 (a JSON answer from the API) on /auth/refresh-token: the token is dead, log
       *   out and go to /login.
       * - anything else (429, network, timeout, 5xx, a 403/HTML page from the CDN): keep the session, set `refreshError`, retry on a
       *   backoff (honouring the server's retryAfter). After a reload ProtectedRoute shows a
       *   "reconnecting" panel instead of the login page until a retry succeeds.
       */
      refreshAccessToken: async () => {
        await runRefresh(get, set);
      },

      isPlatformAdmin: () => get().user?.role === 'PLATFORM_ADMIN',

      isOrgAdmin: () => get().user?.role === 'ORG_ADMIN',

      isOrgStaff: () => get().user?.role === 'ORG_STAFF',

      hasRole: (role) => get().user?.role === role,

      isTokenExpired: () => {
        const tokens = get().tokens;
        if (!tokens) return true;
        return Date.now() >= tokens.expiresAt;
      },

      isTokenNearExpiry: () => {
        const tokens = get().tokens;
        if (!tokens) return true;
        return Date.now() >= tokens.expiresAt - TOKEN_REFRESH_BUFFER_MS;
      },
    }),
    {
      name: 'microcrop-auth',
      // SECURITY: only the (short-lived) refresh token + metadata are persisted
      // to localStorage. The access token is deliberately kept in memory ONLY so
      // it is never readable by XSS from storage — on reload we mint a fresh one
      // via the refresh token below.
      //
      // Remaining tradeoff: the refresh token itself is still in localStorage and
      // thus XSS-readable. Fully closing this requires an httpOnly, SameSite
      // cookie issued by the backend (out of scope for this client-only file); we
      // intentionally do NOT extend its lifetime here. Cost of the in-memory
      // access token: a network refresh is required on each reload. A reload while
      // the backend is unreachable (or rate-limits the refresh) keeps the session and
      // retries; only a rejected refresh token logs out.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        tokens: state.tokens
          ? {
              // accessToken intentionally omitted from persistence.
              accessToken: '',
              refreshToken: state.tokens.refreshToken,
              expiresAt: state.tokens.expiresAt,
            }
          : null,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Access token lives in memory only, so after a reload we always need to
        // exchange the persisted refresh token for a fresh access token.
        if (state.tokens?.refreshToken) {
          state.refreshAccessToken().finally(() => state.setLoading(false));
          return;
        }

        state.setLoading(false);
      },
    }
  )
);

/**
 * Cross-tab sync. zustand persist does not listen to other tabs, so without this a tab keeps
 * a refresh token another tab has already rotated (and the backend deleted), and a sign-out in
 * one tab leaves the others signed in until their next request. The `storage` event fires in
 * every OTHER tab of this origin when one tab writes the auth key.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const state = useAuthStore.getState();
    if (!state.isAuthenticated) return;

    const storedAuth = readStoredAuth();
    if (storedAuth === undefined) return;
    const stored = storedAuth.refreshToken;
    if (stored === null) {
      // Signed out in another tab.
      state.logout();
      redirectToLogin();
      return;
    }
    if (storedAuth.userId !== (state.user?.id ?? null)) {
      // Another tab signed in as someone else. Never graft their refresh token onto this tab's
      // user and role; reload so this tab starts over from the stored session.
      window.location.reload();
      return;
    }
    if (state.tokens && stored !== state.tokens.refreshToken) {
      // Rotated in another tab. Our access token stays valid until it expires; only the
      // refresh token we would use next has changed.
      useAuthStore.setState({ tokens: { ...state.tokens, refreshToken: stored } });
    }
  });
}
