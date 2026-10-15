import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Reloading /org/dashboard with a persisted session. The access token is memory-only, so the
// page starts with user rehydrated from storage but no access token, and refreshes. ProtectedRoute
// calls usePermissions() before its isLoading check, so GET /staff/me/permissions used to go out
// while the refresh was still in flight, with no Authorization header: 401 → onUnauthorized →
// logout → /login, then "Something went wrong" from the aborted route import.
describe('reload on /org/dashboard with a persisted session', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('sends no authenticated request before the rehydrate refresh lands, and stays signed in', async () => {
    const calls: { url: string; auth: string | null; status: number }[] = [];
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((r) => (releaseRefresh = r));
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      const h = (init.headers || {}) as Record<string, string>;
      const auth = h['Authorization'] ?? null;
      if (String(url).includes('/auth/refresh-token')) {
        await refreshGate;
        calls.push({ url, auth, status: 200 });
        return new Response(JSON.stringify({ success: true, data: { accessToken: 'a.b.c', refreshToken: 'r2' } }), { status: 200 });
      }
      const status = auth ? 200 : 401;
      calls.push({ url, auth, status });
      if (!auth) return new Response(JSON.stringify({ success: false, error: { message: 'Unauthorized' } }), { status: 401 });
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('microcrop-auth', JSON.stringify({
      state: {
        user: { id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'ORG_ADMIN', organizationId: 'o1', isActive: true, createdAt: '' },
        isAuthenticated: true,
        tokens: { accessToken: '', refreshToken: 'r1', expiresAt: Date.now() + 3600_000 },
      },
      version: 0,
    }));
    window.history.pushState({}, '', '/org/dashboard');
    const { useAuthStore } = await import('@/stores/authStore');
    const App = (await import('@/App')).default;
    render(<App />);

    // Give every on-mount query time to fire while the refresh is still pending.
    await new Promise((r) => setTimeout(r, 500));
    expect(calls.filter((c) => !c.url.includes('/auth/refresh-token'))).toEqual(
      calls.filter((c) => !c.url.includes('/auth/refresh-token') && c.auth),
    );
    expect(useAuthStore.getState().user).not.toBeNull();

    releaseRefresh();
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('/staff/me/permissions') && c.auth === 'Bearer a.b.c')).toBe(true),
    { timeout: 3000 });

    expect(calls.some((c) => c.status === 401)).toBe(false);
    expect(useAuthStore.getState().user?.id).toBe('u1');
    expect(useAuthStore.getState().tokens?.refreshToken).toBe('r2');
    expect(window.location.pathname).toBe('/org/dashboard');
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});
