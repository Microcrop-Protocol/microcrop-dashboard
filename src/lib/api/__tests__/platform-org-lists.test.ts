import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../client';

/**
 * The platform org detail page must list a NAMED organization's policies and payouts through
 * the platform endpoints. It used the org-scoped /policies and /payouts, which resolve the org
 * from the caller; a platform admin has none, the backend answered 401, and the client's 401
 * handler signed the admin out.
 */
describe('platform per-org lists', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stubFetch() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: [], pagination: { total: 0 } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it.each([
    ['platformGetOrgPolicies', 'policies'],
    ['platformGetOrgPayouts', 'payouts'],
  ] as const)('%s calls /platform/organizations/:orgId/%s, never the org-scoped route', async (method, kind) => {
    const fetchMock = stubFetch();

    await apiClient[method]('org/1', { status: 'ACTIVE' });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`/api/platform/organizations/org%2F1/${kind}?status=ACTIVE`);
    expect(url).not.toMatch(new RegExp(`/api/${kind}`));
  });
});
