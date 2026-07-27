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

let refreshPromise: Promise<void> | null = null;

// Timer that proactively refreshes the access token shortly before it expires,
// so an active session is renewed silently instead of being force-logged-out.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

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

// Wire up 401 handler — on unauthorized API response, auto-logout
apiClient.onUnauthorized(() => {
  const { logout } = useAuthStore.getState();
  logout();
  window.location.href = '/login';
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
          isLoading: false
        });
        scheduleSilentRefresh(get);
      },

      logout: () => {
        clearRefreshTimer();
        apiClient.setAccessToken(null);
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

      refreshAccessToken: async () => {
        // Deduplicate concurrent refresh calls
        if (refreshPromise) return refreshPromise;

        const tokens = get().tokens;
        if (!tokens?.refreshToken) {
          get().logout();
          return;
        }

        refreshPromise = (async () => {
          try {
            const result = await apiClient.refreshToken(tokens.refreshToken);
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
            set({ tokens: newTokens });
            // Arm the next silent refresh ahead of the new expiry.
            scheduleSilentRefresh(get);
          } catch {
            // Refresh failed (invalid/expired refresh token, server down, etc.)
            // — hard logout. We never silently extend a session past this.
            get().logout();
            window.location.href = '/login';
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
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
      // access token: a network refresh is required on each reload, so a reload
      // while the backend is unreachable logs the user out.
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
