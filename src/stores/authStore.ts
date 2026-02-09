import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthTokens, UserRole } from '@/types';
import { apiClient } from '@/lib/api/client';

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

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

// Wire up 401 handler — on unauthorized API response, auto-logout
apiClient.onUnauthorized(() => {
  const { logout } = useAuthStore.getState();
  logout();
  window.location.href = '/login';
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
        set({ tokens });
      },

      login: (user, tokens) => {
        apiClient.setAccessToken(tokens.accessToken);
        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false
        });
      },

      logout: () => {
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
              // Default to 1 hour if backend doesn't specify
              expiresAt: Date.now() + 60 * 60 * 1000,
            };
            apiClient.setAccessToken(newTokens.accessToken);
            set({ tokens: newTokens });
          } catch {
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
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.tokens?.accessToken) {
          apiClient.setAccessToken(state.tokens.accessToken);

          // If token is expired or near expiry, try to refresh
          if (state.isTokenExpired()) {
            state.refreshAccessToken().finally(() => state.setLoading(false));
            return;
          }
        }
        state?.setLoading(false);
      },
    }
  )
);
