import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real auth store wired to the real API client, with only `fetch` faked as a small backend:
// access tokens are accepted until revoked, refresh tokens rotate (each works once, then 401).
// Covers the request path, which the store-only tests can't: a request made while the
// post-reload refresh is still in flight, and a 401 that should refresh-and-retry once.

function accessToken(tag: string): string {
  const payload = btoa(JSON.stringify({ sub: tag, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `h.${payload}.${tag}`;
}

const user = {
  id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B',
  role: 'ORG_ADMIN', isActive: true, createdAt: '2026-01-01',
};

function seedPersisted(refresh: string) {
  localStorage.setItem('microcrop-auth', JSON.stringify({
    state: {
      user,
      isAuthenticated: true,
      tokens: { accessToken: '', refreshToken: refresh, expiresAt: Date.now() + 30 * 60_000 },
    },
    version: 0,
  }));
}

interface Backend {
  validAccess: Set<string>;
  validRefresh: Set<string>;
  refreshCalls: string[];
  refreshResponse?: () => { status: number; body: unknown } | undefined;
  refreshLatencyMs: number;
}

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

function installBackend(initialRefresh: string): Backend {
  const be: Backend = {
    validAccess: new Set(),
    validRefresh: new Set([initialRefresh]),
    refreshCalls: [],
    refreshLatencyMs: 20,
  };
  let n = 1;
  globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = String(url).replace(/^.*\/api/, '');
    if (path === '/auth/refresh-token') {
      const { refreshToken } = JSON.parse(String(init.body));
      be.refreshCalls.push(refreshToken);
      await new Promise((r) => setTimeout(r, be.refreshLatencyMs));
      const forced = be.refreshResponse?.();
      if (forced) return json(forced.status, forced.body);
      if (!be.validRefresh.has(refreshToken)) {
        return json(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Refresh token has been revoked' } });
      }
      be.validRefresh.delete(refreshToken);
      n += 1;
      const at = accessToken(`A${n}`);
      be.validAccess.add(at);
      be.validRefresh.add(`R${n}`);
      return json(200, { success: true, data: { accessToken: at, refreshToken: `R${n}` } });
    }
    const auth = (init.headers as Record<string, string> | undefined)?.Authorization;
    const token = auth?.replace(/^Bearer /, '');
    if (!token || !be.validAccess.has(token)) {
      return json(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
    return json(200, { success: true, data: { id: 'org-1', path } });
  }) as unknown as typeof fetch;
  return be;
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'location', { value: { href: '/org/policies' }, writable: true });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

async function freshModules() {
  vi.resetModules();
  const { useAuthStore } = await import('@/stores/authStore');
  const { apiClient } = await import('@/lib/api/client');
  return { useAuthStore, apiClient };
}

describe('auth session over the real API client', () => {
  it('an API call fired during the post-reload refresh waits for it instead of logging out', async () => {
    seedPersisted('R1');
    const be = installBackend('R1');

    const { useAuthStore, apiClient } = await freshModules();
    // The refresh is in flight and there is no access token yet. A component (or a query
    // that a non-protected route kicked off) asks for data right now.
    expect(useAuthStore.getState().isLoading).toBe(true);
    const org = await apiClient.getMyOrganization();

    expect(org).toMatchObject({ id: 'org-1' });
    expect(be.refreshCalls).toEqual(['R1']);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(window.location.href).toBe('/org/policies');
  });

  it('a 401 triggers ONE shared refresh, and every request is retried with the new token', async () => {
    seedPersisted('R1');
    const be = installBackend('R1');
    const { useAuthStore, apiClient } = await freshModules();
    await vi.waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(be.refreshCalls).toEqual(['R1']);

    // The access token stops being accepted (expired while the laptop slept).
    be.validAccess.clear();

    const results = await Promise.all([
      apiClient.getMyOrganization(),
      apiClient.getMyOrganizationStats(),
      apiClient.getMyKyb(),
    ]);

    expect(results).toHaveLength(3);
    expect(be.refreshCalls).toEqual(['R1', 'R2']); // one refresh for all three 401s
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().tokens?.refreshToken).toBe('R3');
    expect(window.location.href).toBe('/org/policies');
  });

  it('a 401 whose refresh is rejected logs out cleanly to /login', async () => {
    seedPersisted('R1');
    const be = installBackend('R1');
    const { useAuthStore, apiClient } = await freshModules();
    await vi.waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));

    be.validAccess.clear();
    be.validRefresh.clear(); // e.g. password reset revoked every session

    await expect(apiClient.getMyOrganization()).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().tokens).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('a 401 whose refresh is rate-limited surfaces the error without logging out', async () => {
    seedPersisted('R1');
    const be = installBackend('R1');
    const { useAuthStore, apiClient } = await freshModules();
    await vi.waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));

    be.validAccess.clear();
    be.refreshResponse = () => ({
      status: 429,
      body: {
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests.', details: { limit: 30, retryAfter: 60 } },
      },
    });

    await expect(apiClient.getMyOrganization()).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().tokens?.refreshToken).toBe('R2');
    expect(window.location.href).toBe('/org/policies');
  });

  it('requests queued behind a failed reload refresh fail fast instead of starting a second refresh', async () => {
    seedPersisted('R1');
    const be = installBackend('R1');
    be.refreshResponse = () => ({
      status: 429,
      body: {
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests.', details: { limit: 30, retryAfter: 60 } },
      },
    });
    const { useAuthStore, apiClient } = await freshModules();
    // Fired while the post-reload refresh is in flight, so they wait behind it.
    const pending = [apiClient.getMyOrganization(), apiClient.getMyOrganizationStats()];

    for (const p of pending) await expect(p).rejects.toMatchObject({ status: 0 });
    await vi.waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(be.refreshCalls).toEqual(['R1']); // retryAfter is honoured, no extra refresh
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(window.location.href).toBe('/org/policies');
  });

  it('a 401 while a refresh retry is scheduled does not jump the queue', async () => {
    seedPersisted('R1');
    const be = installBackend('R1');
    const { useAuthStore, apiClient } = await freshModules();
    await vi.waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));

    be.validAccess.clear();
    be.refreshResponse = () => ({
      status: 429,
      body: {
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests.', details: { limit: 30, retryAfter: 60 } },
      },
    });
    await expect(apiClient.getMyOrganization()).rejects.toMatchObject({ status: 401 });
    expect(be.refreshCalls).toEqual(['R1', 'R2']);

    await expect(apiClient.getMyOrganizationStats()).rejects.toMatchObject({ status: 401 });
    expect(be.refreshCalls).toEqual(['R1', 'R2']); // waits for the scheduled retry
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('a refresh that never answers times out as a network error and keeps the session', async () => {
    // AbortSignal.timeout is missing from jsdom (and runs on the platform's own timer where it
    // exists), so stand in for it with a signal the test fires, and check the client asked for
    // the 15-second budget.
    const timeout = new AbortController();
    const original = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');
    const timeoutSpy = vi.fn(() => timeout.signal);
    Object.defineProperty(AbortSignal, 'timeout', { value: timeoutSpy, configurable: true });
    let useAuthStore: Awaited<ReturnType<typeof freshModules>>['useAuthStore'] | undefined;
    try {
      seedPersisted('R1');
      globalThis.fetch = vi.fn((_url: string, init: RequestInit = {}) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation timed out.', 'TimeoutError'))
          );
        })
      ) as unknown as typeof fetch;
      const store = (await freshModules()).useAuthStore;
      useAuthStore = store;
      expect(store.getState().isLoading).toBe(true);
      expect(timeoutSpy).toHaveBeenCalledWith(15_000);

      timeout.abort();
      await vi.waitFor(() => expect(store.getState().isLoading).toBe(false));

      expect(store.getState().isAuthenticated).toBe(true);
      expect(store.getState().refreshError).toBeTruthy();
      expect(window.location.href).toBe('/org/policies');
    } finally {
      if (original) Object.defineProperty(AbortSignal, 'timeout', original);
      else delete (AbortSignal as unknown as Record<string, unknown>).timeout;
      useAuthStore?.getState().logout(); // cancel the scheduled retry
    }
  });

  it('a reload whose refresh is rejected logs out to /login', async () => {
    seedPersisted('R-revoked');
    installBackend('R1');
    const { useAuthStore } = await freshModules();
    await vi.waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(window.location.href).toBe('/login');
  });
});
