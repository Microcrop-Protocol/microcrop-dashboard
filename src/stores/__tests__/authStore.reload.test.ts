import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// "Refreshing the page logs us out."
//
// The access token lives in memory only, so every page load exchanges the persisted refresh
// token for a new one. The store is imported fresh per test so zustand persist rehydrates from
// the localStorage we seed, exactly as a page reload does. The refresh call is mocked; the
// mock server below rotates tokens the way the backend does (the old one is deleted, a replay
// of it gets 401).

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const refreshToken = vi.fn();
vi.mock('@/lib/api/client', () => ({
  ApiError,
  apiClient: {
    setAccessToken: vi.fn(),
    getAccessToken: vi.fn(),
    onUnauthorized: vi.fn(),
    onOrgDeactivated: vi.fn(),
    onRefreshNeeded: vi.fn(),
    setAuthGate: vi.fn(),
    refreshToken: (...a: unknown[]) => refreshToken(...a),
  },
}));

const user = {
  id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B',
  role: 'ORG_ADMIN', isActive: true, createdAt: '2026-01-01',
};

/** A JWT-shaped access token whose `exp` is an hour out, so expiry is derived from it. */
function accessToken(tag: string): string {
  const payload = btoa(JSON.stringify({ sub: tag, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `h.${payload}.${tag}`;
}

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

function storedRefreshToken(): string | undefined {
  const raw = localStorage.getItem('microcrop-auth');
  return raw ? JSON.parse(raw).state.tokens?.refreshToken : undefined;
}

/** A backend that rotates: each refresh token works once, then 401. */
function rotatingServer(initial: string, latencyMs = 0) {
  const valid = new Set([initial]);
  let n = Number(initial.replace(/\D/g, '')) || 1;
  return async (rt: string) => {
    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
    if (!valid.has(rt)) throw new ApiError('Refresh token has been revoked', 401, 'UNAUTHORIZED');
    valid.delete(rt);
    n += 1;
    const next = `R${n}`;
    valid.add(next);
    return { accessToken: accessToken(next), refreshToken: next };
  };
}

async function reload() {
  vi.resetModules();
  const mod = await import('@/stores/authStore');
  // let onRehydrateStorage's refresh settle
  await vi.waitFor(() => expect(mod.useAuthStore.getState().isLoading).toBe(false));
  return mod.useAuthStore;
}

beforeEach(() => {
  localStorage.clear();
  refreshToken.mockReset();
  // jsdom: make the hard redirect observable instead of a navigation
  Object.defineProperty(window, 'location', { value: { href: '/org/policies' }, writable: true });
});

afterEach(() => {
  vi.useRealTimers();
  // Remove any fake Web Locks a test installed.
  delete (navigator as unknown as Record<string, unknown>).locks;
});

describe('page reload', () => {
  it('with a valid refresh token keeps the session and stays on the same page', async () => {
    seedPersisted('R1');
    refreshToken.mockImplementation(rotatingServer('R1'));

    const store = await reload();

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(refreshToken).toHaveBeenCalledWith('R1');
    expect(store.getState().isAuthenticated).toBe(true);
    expect(store.getState().tokens?.accessToken).toBe(accessToken('R2'));
    expect(storedRefreshToken()).toBe('R2');
    expect(window.location.href).toBe('/org/policies');
  });

  it('a rate-limited refresh (429) keeps the session, and retries after retryAfter', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedPersisted('R1');
    const server = rotatingServer('R1');
    refreshToken
      .mockRejectedValueOnce(
        new ApiError('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', undefined, {
          limit: 5,
          retryAfter: 42,
        })
      )
      .mockImplementation(server);

    const store = await reload();

    expect(store.getState().isAuthenticated).toBe(true);
    expect(store.getState().tokens?.refreshToken).toBe('R1');
    expect(store.getState().refreshError).toBeTruthy();
    expect(storedRefreshToken()).toBe('R1');
    expect(window.location.href).toBe('/org/policies');

    // Not before the server said to ...
    await vi.advanceTimersByTimeAsync(41_000);
    expect(refreshToken).toHaveBeenCalledTimes(1);
    // ... then the retry restores the session without a login.
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(store.getState().tokens?.refreshToken).toBe('R2'));
    expect(store.getState().tokens?.accessToken).toMatch(/\.R2$/);
    expect(store.getState().refreshError).toBeNull();
    expect(store.getState().isAuthenticated).toBe(true);
  });

  it('a network failure (status 0) keeps the session and retries on a backoff', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedPersisted('R1');
    refreshToken
      .mockRejectedValueOnce(new ApiError('Network error. Please check your connection.', 0))
      .mockImplementation(rotatingServer('R1'));

    const store = await reload();

    expect(store.getState().isAuthenticated).toBe(true);
    expect(store.getState().tokens?.refreshToken).toBe('R1');
    expect(window.location.href).toBe('/org/policies');

    await vi.advanceTimersByTimeAsync(2_500);
    await vi.waitFor(() => expect(store.getState().tokens?.refreshToken).toBe('R2'));
    expect(store.getState().tokens?.accessToken).toMatch(/\.R2$/);
  });

  it('a 5xx keeps the session', async () => {
    seedPersisted('R1');
    refreshToken.mockRejectedValue(new ApiError('Internal server error', 503));

    const store = await reload();

    expect(store.getState().isAuthenticated).toBe(true);
    expect(store.getState().tokens?.refreshToken).toBe('R1');
    expect(window.location.href).toBe('/org/policies');
  });

  it('an invalid or revoked refresh token (401) logs out cleanly to /login', async () => {
    seedPersisted('R1');
    refreshToken.mockRejectedValue(new ApiError('Refresh token has been revoked', 401, 'UNAUTHORIZED'));

    const store = await reload();

    expect(store.getState().isAuthenticated).toBe(false);
    expect(store.getState().user).toBeNull();
    expect(store.getState().tokens).toBeNull();
    expect(storedRefreshToken()).toBeUndefined();
    expect(window.location.href).toBe('/login');
  });
});

describe('concurrent refreshes do not invalidate each other', () => {
  it('rehydrate, the silent-refresh timer and repeated calls in one tab share one request', async () => {
    seedPersisted('R1');
    refreshToken.mockImplementation(rotatingServer('R1', 20));

    vi.resetModules();
    const { useAuthStore } = await import('@/stores/authStore');
    // Rehydrate's refresh is in flight; a StrictMode double mount and a timer fire on top.
    await Promise.all([
      useAuthStore.getState().refreshAccessToken(),
      useAuthStore.getState().refreshAccessToken(),
      useAuthStore.getState().refreshAccessToken(),
    ]);

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().tokens?.refreshToken).toBe('R2');
  });

  it('a tab uses the refresh token another tab rotated into storage, not its stale in-memory one', async () => {
    seedPersisted('R1');
    refreshToken.mockImplementation(rotatingServer('R1'));
    const tabA = await reload(); // tab A rotates R1 -> R2 and holds R2 in memory
    expect(tabA.getState().tokens?.refreshToken).toBe('R2');

    // Tab B loads and rotates R2 -> R3, writing R3 to the shared localStorage.
    await reload();
    expect(storedRefreshToken()).toBe('R3');

    // Tab A's silent-refresh timer fires. Its in-memory R2 has been deleted server-side.
    await tabA.getState().refreshAccessToken();

    expect(refreshToken).toHaveBeenLastCalledWith('R3');
    expect(tabA.getState().isAuthenticated).toBe(true);
    expect(window.location.href).toBe('/org/policies');
  });

  it('two tabs refreshing at the same moment are serialized by a Web Lock', async () => {
    // Minimal Web Locks: one queue per name, held until the callback settles.
    const queues = new Map<string, Promise<unknown>>();
    const request = vi.fn((name: string, fn: () => Promise<unknown>) => {
      const run = (queues.get(name) ?? Promise.resolve()).then(() => fn());
      queues.set(name, run.catch(() => undefined));
      return run;
    });
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

    seedPersisted('R1');
    refreshToken.mockImplementation(rotatingServer('R1', 20));
    const tabA = await reload(); // R1 -> R2
    const tabB = await reload(); // R2 -> R3 (B read R2 from storage)
    expect(storedRefreshToken()).toBe('R3');

    // Both timers fire together. Without the lock both would send R3; one would get 401.
    await Promise.all([tabA.getState().refreshAccessToken(), tabB.getState().refreshAccessToken()]);

    expect(request).toHaveBeenCalledWith('microcrop-auth-refresh', expect.any(Function));
    expect(tabA.getState().isAuthenticated).toBe(true);
    expect(tabB.getState().isAuthenticated).toBe(true);
    expect(window.location.href).toBe('/org/policies');
    expect(storedRefreshToken()).toBe('R5');
  });

  it('a sign-out in another tab is picked up instead of refreshing with a dead token', async () => {
    seedPersisted('R1');
    refreshToken.mockImplementation(rotatingServer('R1'));
    const tab = await reload();

    // Another tab signs out: persist writes tokens: null.
    localStorage.setItem('microcrop-auth', JSON.stringify({
      state: { user: null, isAuthenticated: false, tokens: null },
      version: 0,
    }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'microcrop-auth' }));

    expect(tab.getState().isAuthenticated).toBe(false);
    expect(window.location.href).toBe('/login');
    expect(refreshToken).toHaveBeenCalledTimes(1); // only the reload's own refresh
  });
});
