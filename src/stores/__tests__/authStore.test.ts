import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the apiClient module before importing the store
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    setAccessToken: vi.fn(),
    onUnauthorized: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api/client';
import type { User, AuthTokens } from '@/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser: User = {
  id: '1',
  email: 'test@test.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'PLATFORM_ADMIN' as const,
  isActive: true,
  createdAt: '2024-01-01',
};

const mockTokens: AuthTokens = {
  accessToken: 'access-123',
  refreshToken: 'refresh-123',
  expiresAt: Date.now() + 3600000, // 1 hour from now
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  // Logout clears the Zustand state and calls apiClient.setAccessToken(null)
  useAuthStore.getState().logout();
  localStorage.clear();
  vi.clearAllMocks();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // =========================================================================
  // 1. Initial state
  // =========================================================================

  describe('initial state', () => {
    it('should have user as null', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should have tokens as null', () => {
      expect(useAuthStore.getState().tokens).toBeNull();
    });

    it('should have isAuthenticated as false', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should have isLoading as false after logout reset', () => {
      // After calling logout() in beforeEach, isLoading is set to false.
      // The store's *default* initial value is true, but logout sets it to false.
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // =========================================================================
  // 2. login()
  // =========================================================================

  describe('login()', () => {
    it('should set user on login', () => {
      useAuthStore.getState().login(mockUser, mockTokens);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('should set tokens on login', () => {
      useAuthStore.getState().login(mockUser, mockTokens);
      expect(useAuthStore.getState().tokens).toEqual(mockTokens);
    });

    it('should set isAuthenticated to true', () => {
      useAuthStore.getState().login(mockUser, mockTokens);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should set isLoading to false', () => {
      // First set isLoading to true to verify login changes it
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().login(mockUser, mockTokens);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should call apiClient.setAccessToken with the access token', () => {
      useAuthStore.getState().login(mockUser, mockTokens);
      expect(apiClient.setAccessToken).toHaveBeenCalledWith('access-123');
    });
  });

  // =========================================================================
  // 3. logout()
  // =========================================================================

  describe('logout()', () => {
    beforeEach(() => {
      // Log in first so we have state to clear
      useAuthStore.getState().login(mockUser, mockTokens);
      vi.clearAllMocks();
    });

    it('should clear user to null', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should clear tokens to null', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().tokens).toBeNull();
    });

    it('should set isAuthenticated to false', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should set isLoading to false', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should call apiClient.setAccessToken with null', () => {
      useAuthStore.getState().logout();
      expect(apiClient.setAccessToken).toHaveBeenCalledWith(null);
    });
  });

  // =========================================================================
  // 4. setUser()
  // =========================================================================

  describe('setUser()', () => {
    it('should set the user', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('should set isAuthenticated to true when user is provided', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should set isAuthenticated to false when user is null', () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUser(null);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should clear user to null', () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUser(null);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  // =========================================================================
  // 5. setTokens()
  // =========================================================================

  describe('setTokens()', () => {
    it('should set the tokens', () => {
      useAuthStore.getState().setTokens(mockTokens);
      expect(useAuthStore.getState().tokens).toEqual(mockTokens);
    });

    it('should call apiClient.setAccessToken with the access token', () => {
      useAuthStore.getState().setTokens(mockTokens);
      expect(apiClient.setAccessToken).toHaveBeenCalledWith('access-123');
    });

    it('should call apiClient.setAccessToken with null when tokens are null', () => {
      useAuthStore.getState().setTokens(null);
      expect(apiClient.setAccessToken).toHaveBeenCalledWith(null);
    });

    it('should clear tokens to null', () => {
      useAuthStore.getState().setTokens(mockTokens);
      useAuthStore.getState().setTokens(null);
      expect(useAuthStore.getState().tokens).toBeNull();
    });
  });

  // =========================================================================
  // 6. Role helpers
  // =========================================================================

  describe('role helpers', () => {
    describe('isPlatformAdmin()', () => {
      it('should return true for PLATFORM_ADMIN role', () => {
        useAuthStore.getState().setUser({ ...mockUser, role: 'PLATFORM_ADMIN' });
        expect(useAuthStore.getState().isPlatformAdmin()).toBe(true);
      });

      it('should return false for non-PLATFORM_ADMIN role', () => {
        useAuthStore.getState().setUser({ ...mockUser, role: 'ORG_ADMIN' });
        expect(useAuthStore.getState().isPlatformAdmin()).toBe(false);
      });

      it('should return false when no user is set', () => {
        expect(useAuthStore.getState().isPlatformAdmin()).toBe(false);
      });
    });

    describe('isOrgAdmin()', () => {
      it('should return true for ORG_ADMIN role', () => {
        useAuthStore.getState().setUser({ ...mockUser, role: 'ORG_ADMIN' });
        expect(useAuthStore.getState().isOrgAdmin()).toBe(true);
      });

      it('should return false for non-ORG_ADMIN role', () => {
        useAuthStore.getState().setUser({ ...mockUser, role: 'PLATFORM_ADMIN' });
        expect(useAuthStore.getState().isOrgAdmin()).toBe(false);
      });

      it('should return false when no user is set', () => {
        expect(useAuthStore.getState().isOrgAdmin()).toBe(false);
      });
    });

    describe('isOrgStaff()', () => {
      it('should return true for ORG_STAFF role', () => {
        useAuthStore.getState().setUser({ ...mockUser, role: 'ORG_STAFF' });
        expect(useAuthStore.getState().isOrgStaff()).toBe(true);
      });

      it('should return false for non-ORG_STAFF role', () => {
        useAuthStore.getState().setUser({ ...mockUser, role: 'PLATFORM_ADMIN' });
        expect(useAuthStore.getState().isOrgStaff()).toBe(false);
      });

      it('should return false when no user is set', () => {
        expect(useAuthStore.getState().isOrgStaff()).toBe(false);
      });
    });

    describe('hasRole()', () => {
      it('should return true when user has the specified role', () => {
        useAuthStore.getState().setUser({ ...mockUser, role: 'ORG_ADMIN' });
        expect(useAuthStore.getState().hasRole('ORG_ADMIN')).toBe(true);
      });

      it('should return false when user has a different role', () => {
        useAuthStore.getState().setUser({ ...mockUser, role: 'ORG_ADMIN' });
        expect(useAuthStore.getState().hasRole('PLATFORM_ADMIN')).toBe(false);
      });

      it('should return false when no user is set', () => {
        expect(useAuthStore.getState().hasRole('PLATFORM_ADMIN')).toBe(false);
      });

      it('should work for each role type', () => {
        const roles = ['PLATFORM_ADMIN', 'ORG_ADMIN', 'ORG_STAFF'] as const;
        for (const role of roles) {
          useAuthStore.getState().setUser({ ...mockUser, role });
          expect(useAuthStore.getState().hasRole(role)).toBe(true);
          // The other roles should be false
          for (const otherRole of roles) {
            if (otherRole !== role) {
              expect(useAuthStore.getState().hasRole(otherRole)).toBe(false);
            }
          }
        }
      });
    });
  });

  // =========================================================================
  // 7. isTokenExpired()
  // =========================================================================

  describe('isTokenExpired()', () => {
    it('should return true when there are no tokens', () => {
      expect(useAuthStore.getState().isTokenExpired()).toBe(true);
    });

    it('should return true when token expiresAt is in the past', () => {
      const expiredTokens: AuthTokens = {
        ...mockTokens,
        expiresAt: Date.now() - 1000, // 1 second ago
      };
      useAuthStore.getState().setTokens(expiredTokens);
      expect(useAuthStore.getState().isTokenExpired()).toBe(true);
    });

    it('should return false when token expiresAt is in the future', () => {
      const validTokens: AuthTokens = {
        ...mockTokens,
        expiresAt: Date.now() + 3600000, // 1 hour from now
      };
      useAuthStore.getState().setTokens(validTokens);
      expect(useAuthStore.getState().isTokenExpired()).toBe(false);
    });

    it('should return true when token expiresAt is exactly now', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const borderTokens: AuthTokens = {
        ...mockTokens,
        expiresAt: now, // exactly now: Date.now() >= expiresAt is true
      };
      useAuthStore.getState().setTokens(borderTokens);
      expect(useAuthStore.getState().isTokenExpired()).toBe(true);
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // 8. isTokenNearExpiry()
  // =========================================================================

  describe('isTokenNearExpiry()', () => {
    it('should return true when there are no tokens', () => {
      expect(useAuthStore.getState().isTokenNearExpiry()).toBe(true);
    });

    it('should return true when within 5-minute buffer of expiry', () => {
      const nearExpiryTokens: AuthTokens = {
        ...mockTokens,
        expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes from now (within 5-min buffer)
      };
      useAuthStore.getState().setTokens(nearExpiryTokens);
      expect(useAuthStore.getState().isTokenNearExpiry()).toBe(true);
    });

    it('should return true when exactly at 5-minute boundary', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const boundaryTokens: AuthTokens = {
        ...mockTokens,
        expiresAt: now + 5 * 60 * 1000, // exactly 5 minutes from now
      };
      useAuthStore.getState().setTokens(boundaryTokens);
      // Date.now() >= expiresAt - 5min => now >= now + 5min - 5min => now >= now => true
      expect(useAuthStore.getState().isTokenNearExpiry()).toBe(true);
      vi.restoreAllMocks();
    });

    it('should return false when well before expiry', () => {
      const freshTokens: AuthTokens = {
        ...mockTokens,
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes from now
      };
      useAuthStore.getState().setTokens(freshTokens);
      expect(useAuthStore.getState().isTokenNearExpiry()).toBe(false);
    });

    it('should return true when token is already expired', () => {
      const expiredTokens: AuthTokens = {
        ...mockTokens,
        expiresAt: Date.now() - 1000, // already expired
      };
      useAuthStore.getState().setTokens(expiredTokens);
      expect(useAuthStore.getState().isTokenNearExpiry()).toBe(true);
    });
  });

  // =========================================================================
  // 9. setLoading()
  // =========================================================================

  describe('setLoading()', () => {
    it('should set isLoading to true', () => {
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it('should set isLoading to false', () => {
      useAuthStore.getState().setLoading(true);
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // =========================================================================
  // 10. refreshAccessToken()
  // =========================================================================

  describe('refreshAccessToken()', () => {
    it('should call apiClient.refreshToken with the refresh token', async () => {
      vi.mocked(apiClient.refreshToken).mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      useAuthStore.getState().login(mockUser, mockTokens);
      vi.clearAllMocks();

      await useAuthStore.getState().refreshAccessToken();

      expect(apiClient.refreshToken).toHaveBeenCalledWith('refresh-123');
    });

    it('should update tokens after successful refresh', async () => {
      vi.mocked(apiClient.refreshToken).mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      useAuthStore.getState().login(mockUser, mockTokens);
      vi.clearAllMocks();

      await useAuthStore.getState().refreshAccessToken();

      const tokens = useAuthStore.getState().tokens;
      expect(tokens).not.toBeNull();
      expect(tokens!.accessToken).toBe('new-access-token');
      expect(tokens!.refreshToken).toBe('new-refresh-token');
    });

    it('should call apiClient.setAccessToken with the new access token', async () => {
      vi.mocked(apiClient.refreshToken).mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      useAuthStore.getState().login(mockUser, mockTokens);
      vi.clearAllMocks();

      await useAuthStore.getState().refreshAccessToken();

      expect(apiClient.setAccessToken).toHaveBeenCalledWith('new-access-token');
    });

    it('should logout when no refresh token is available', async () => {
      // No tokens set, so refreshToken is undefined
      await useAuthStore.getState().refreshAccessToken();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should logout on refresh failure', async () => {
      vi.mocked(apiClient.refreshToken).mockRejectedValue(new Error('Refresh failed'));

      useAuthStore.getState().login(mockUser, mockTokens);
      vi.clearAllMocks();

      await useAuthStore.getState().refreshAccessToken();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().tokens).toBeNull();
    });
  });

});
