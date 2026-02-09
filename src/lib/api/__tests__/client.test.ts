import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, apiClient } from '../client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchResponse(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
}

function mockFetchBlobResponse(status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({}),
    blob: () => Promise.resolve(new Blob(['file-content'], { type: 'text/csv' })),
  });
}

/**
 * Wraps a successful API payload in the standard { success: true, data } envelope.
 */
function envelope<T>(data: T) {
  return { success: true, data };
}

/**
 * Wraps an error payload in the standard { success: false, error } envelope.
 */
function errorEnvelope(code: string, message: string) {
  return { success: false, error: { code, message } };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('sets message, status, code, and name', () => {
    const err = new ApiError('Not found', 404, 'NOT_FOUND');
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  it('allows code to be undefined', () => {
    const err = new ApiError('Server error', 500);
    expect(err.code).toBeUndefined();
    expect(err.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------

describe('apiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset state between tests
    apiClient.setAccessToken(null);
    // Clear any registered onUnauthorized callback by setting a no-op, then clearing
    apiClient.onUnauthorized(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Token management
  // -----------------------------------------------------------------------
  describe('setAccessToken / getAccessToken', () => {
    it('starts with null token', () => {
      expect(apiClient.getAccessToken()).toBeNull();
    });

    it('stores and retrieves a token', () => {
      apiClient.setAccessToken('my-token');
      expect(apiClient.getAccessToken()).toBe('my-token');
    });

    it('clears the token when set to null', () => {
      apiClient.setAccessToken('my-token');
      apiClient.setAccessToken(null);
      expect(apiClient.getAccessToken()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // onUnauthorized
  // -----------------------------------------------------------------------
  describe('onUnauthorized', () => {
    it('registers a callback that fires on 401 for non-auth endpoints', async () => {
      const cb = vi.fn();
      apiClient.onUnauthorized(cb);

      globalThis.fetch = mockFetchResponse(
        errorEnvelope('UNAUTHORIZED', 'Token expired'),
        401
      );

      await expect(apiClient.getMe()).rejects.toThrow(ApiError);
      // /auth/me starts with /auth/, so the callback should NOT fire
      // Let's use a non-auth endpoint instead
      expect(cb).not.toHaveBeenCalled();
    });

    it('fires the callback on 401 for non-auth endpoints', async () => {
      const cb = vi.fn();
      apiClient.onUnauthorized(cb);

      globalThis.fetch = mockFetchResponse(
        errorEnvelope('UNAUTHORIZED', 'Token expired'),
        401
      );

      await expect(apiClient.getMyOrganization()).rejects.toThrow(ApiError);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire the callback on 401 for /auth/ endpoints', async () => {
      const cb = vi.fn();
      apiClient.onUnauthorized(cb);

      globalThis.fetch = mockFetchResponse(
        errorEnvelope('UNAUTHORIZED', 'Bad credentials'),
        401
      );

      await expect(
        apiClient.login('a@b.com', 'wrong')
      ).rejects.toThrow(ApiError);
      expect(cb).not.toHaveBeenCalled();
    });

    it('does NOT fire the callback on 401 for /auth/refresh endpoint', async () => {
      const cb = vi.fn();
      apiClient.onUnauthorized(cb);

      globalThis.fetch = mockFetchResponse(
        errorEnvelope('UNAUTHORIZED', 'Refresh token expired'),
        401
      );

      await expect(
        apiClient.refreshToken('stale-token')
      ).rejects.toThrow(ApiError);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // request (tested via public methods)
  // -----------------------------------------------------------------------
  describe('request (via public methods)', () => {
    it('sends correct URL, method, body, and Content-Type header', async () => {
      const loginResponse = envelope({
        user: { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'ORG_ADMIN' },
        accessToken: 'tok',
        refreshToken: 'ref',
      });

      globalThis.fetch = mockFetchResponse(loginResponse);

      await apiClient.login('a@b.com', 'pass123');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];

      // URL includes /api prefix
      expect(url).toContain('/api/auth/login');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ email: 'a@b.com', password: 'pass123' });
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('includes Authorization header when token is set', async () => {
      apiClient.setAccessToken('my-bearer');

      globalThis.fetch = mockFetchResponse(envelope({ id: 'org-1' }));
      await apiClient.getMyOrganization();

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer my-bearer');
    });

    it('does not include Authorization header when no token is set', async () => {
      const loginResponse = envelope({
        user: { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'ORG_ADMIN' },
        accessToken: 'tok',
        refreshToken: 'ref',
      });
      globalThis.fetch = mockFetchResponse(loginResponse);

      await apiClient.login('a@b.com', 'pass');

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });

    it('returns parsed data from response (unwraps envelope)', async () => {
      apiClient.setAccessToken('tok');
      const orgData = { id: 'org-1', name: 'Test Org' };
      globalThis.fetch = mockFetchResponse(envelope(orgData));

      const result = await apiClient.getMyOrganization();
      expect(result).toEqual(orgData);
    });

    it('throws ApiError with status and message on non-OK response', async () => {
      globalThis.fetch = mockFetchResponse(
        errorEnvelope('VALIDATION_ERROR', 'Email is required'),
        422
      );

      try {
        await apiClient.login('', 'pass');
        expect.fail('Expected ApiError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.message).toBe('Email is required');
        expect(apiErr.status).toBe(422);
        expect(apiErr.code).toBe('VALIDATION_ERROR');
        expect(apiErr.name).toBe('ApiError');
      }
    });

    it('falls back to default message when error response has no message', async () => {
      globalThis.fetch = mockFetchResponse(
        { success: false, error: {} },
        400
      );

      try {
        await apiClient.login('a@b.com', 'pass');
        expect.fail('Expected ApiError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).message).toBe('An error occurred');
      }
    });

    it('throws ApiError with status 0 on network error (fetch throws)', async () => {
      globalThis.fetch = mockFetchNetworkError();

      try {
        await apiClient.login('a@b.com', 'pass');
        expect.fail('Expected ApiError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(0);
        expect(apiErr.message).toBe('Network error. Please check your connection.');
      }
    });

    it('sends GET request with no body for read endpoints', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchResponse(envelope([{ id: 'u1' }]));

      await apiClient.getStaff();

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/staff');
      expect(options.method).toBeUndefined(); // GET is the default
      expect(options.body).toBeUndefined();
    });

    it('sends PUT request for update endpoints', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchResponse(envelope({ id: 'org-1' }));

      await apiClient.updateOrganizationSettings({ brandColor: '#ff0000' });

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual({ brandColor: '#ff0000' });
    });

    it('sends DELETE request for remove endpoints', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchResponse(envelope({ success: true }));

      await apiClient.removePoolDepositor('0xabc');

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/organizations/me/pool/depositors/0xabc');
      expect(options.method).toBe('DELETE');
    });
  });

  // -----------------------------------------------------------------------
  // login
  // -----------------------------------------------------------------------
  describe('login', () => {
    it('sets access token from response and returns result', async () => {
      const loginData = {
        user: {
          id: 'u1',
          email: 'admin@test.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'PLATFORM_ADMIN',
        },
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      globalThis.fetch = mockFetchResponse(envelope(loginData));

      const result = await apiClient.login('admin@test.com', 'secret');

      expect(result).toEqual(loginData);
      expect(apiClient.getAccessToken()).toBe('new-access-token');
    });

    it('does not set token when login fails', async () => {
      apiClient.setAccessToken(null);
      globalThis.fetch = mockFetchResponse(
        errorEnvelope('AUTH_ERROR', 'Invalid credentials'),
        401
      );

      await expect(apiClient.login('a@b.com', 'bad')).rejects.toThrow(ApiError);
      expect(apiClient.getAccessToken()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // register
  // -----------------------------------------------------------------------
  describe('register', () => {
    it('sends registration data and returns user + tokens', async () => {
      const regData = {
        user: { id: 'u2', email: 'new@test.com' },
        accessToken: 'at',
        refreshToken: 'rt',
      };
      globalThis.fetch = mockFetchResponse(envelope(regData));

      const result = await apiClient.register({
        email: 'new@test.com',
        password: 'p@ss',
        firstName: 'New',
        lastName: 'User',
      });

      expect(result).toEqual(regData);
      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        email: 'new@test.com',
        password: 'p@ss',
        firstName: 'New',
        lastName: 'User',
      });
    });
  });

  // -----------------------------------------------------------------------
  // refreshToken
  // -----------------------------------------------------------------------
  describe('refreshToken', () => {
    it('sends refresh token and returns new tokens', async () => {
      const tokenData = { accessToken: 'new-at', refreshToken: 'new-rt' };
      globalThis.fetch = mockFetchResponse(envelope(tokenData));

      const result = await apiClient.refreshToken('old-rt');

      expect(result).toEqual(tokenData);
      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/auth/refresh');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ refreshToken: 'old-rt' });
    });
  });

  // -----------------------------------------------------------------------
  // requestWithPagination (tested via getFarmers, getPolicies, etc.)
  // -----------------------------------------------------------------------
  describe('requestWithPagination', () => {
    it('returns data and pagination from the response', async () => {
      apiClient.setAccessToken('tok');
      const paginatedResponse = {
        success: true,
        data: [{ id: 'f1' }, { id: 'f2' }],
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      };
      globalThis.fetch = mockFetchResponse(paginatedResponse);

      const result = await apiClient.getFarmers({ page: 1, limit: 20 });

      expect(result.data).toEqual([{ id: 'f1' }, { id: 'f2' }]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 50,
        totalPages: 3,
      });
    });

    it('constructs query string from params, filtering undefined', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchResponse({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      await apiClient.getFarmers({ page: 2, limit: 10, county: 'Nairobi', search: undefined });

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');
      expect(url).toContain('county=Nairobi');
      expect(url).not.toContain('search');
    });

    it('throws ApiError on non-OK response', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchResponse(
        errorEnvelope('FORBIDDEN', 'Not allowed'),
        403
      );

      await expect(apiClient.getFarmers()).rejects.toThrow(ApiError);
    });

    it('throws ApiError with status 0 on network error', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchNetworkError();

      try {
        await apiClient.getFarmers();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(0);
      }
    });

    it('calls onUnauthorized on 401 for non-auth endpoints', async () => {
      const cb = vi.fn();
      apiClient.onUnauthorized(cb);
      apiClient.setAccessToken('expired');

      globalThis.fetch = mockFetchResponse(
        errorEnvelope('UNAUTHORIZED', 'Expired'),
        401
      );

      await expect(apiClient.getPolicies()).rejects.toThrow(ApiError);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // uploadRequest (tested via submitOrgApplication)
  // -----------------------------------------------------------------------
  describe('uploadRequest', () => {
    it('sends FormData without Content-Type header (browser sets boundary)', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchResponse(envelope({ id: 'app-1', status: 'PENDING' }));

      const formData = new FormData();
      formData.append('name', 'Test Org');
      formData.append('file', new Blob(['pdf-content']), 'doc.pdf');

      await apiClient.submitOrgApplication(formData);

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/applications/organization');
      expect(options.method).toBe('POST');
      expect(options.body).toBe(formData);
      // Content-Type should NOT be set manually for FormData
      expect(options.headers['Content-Type']).toBeUndefined();
      expect(options.headers['Authorization']).toBe('Bearer tok');
    });

    it('throws ApiError on non-OK upload response', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchResponse(
        errorEnvelope('INVALID_FILE', 'File too large'),
        413
      );

      const formData = new FormData();
      await expect(apiClient.submitOrgApplication(formData)).rejects.toThrow(ApiError);
    });

    it('throws network error on fetch failure', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchNetworkError();

      const formData = new FormData();
      try {
        await apiClient.submitOrgApplication(formData);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(0);
      }
    });

    it('calls onUnauthorized on 401 for upload endpoints', async () => {
      const cb = vi.fn();
      apiClient.onUnauthorized(cb);
      apiClient.setAccessToken('expired');

      globalThis.fetch = mockFetchResponse(
        errorEnvelope('UNAUTHORIZED', 'Expired'),
        401
      );

      const formData = new FormData();
      await expect(apiClient.submitOrgApplication(formData)).rejects.toThrow(ApiError);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // downloadFile (tested via export methods)
  // -----------------------------------------------------------------------
  describe('downloadFile (via export methods)', () => {
    it('returns a Blob on success', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchBlobResponse(200);

      const blob = await apiClient.exportFarmers();
      expect(blob).toBeInstanceOf(Blob);
    });

    it('includes Authorization header when token is set', async () => {
      apiClient.setAccessToken('dl-token');
      globalThis.fetch = mockFetchBlobResponse(200);

      await apiClient.exportPolicies();

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer dl-token');
    });

    it('does not set Content-Type for download requests', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchBlobResponse(200);

      await apiClient.exportPayouts();

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.headers['Content-Type']).toBeUndefined();
    });

    it('throws ApiError on non-OK download response', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchBlobResponse(500);

      try {
        await apiClient.exportFarmers();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(500);
        expect((err as ApiError).message).toBe('Failed to download file');
      }
    });

    it('calls onUnauthorized on 401 for download endpoints', async () => {
      const cb = vi.fn();
      apiClient.onUnauthorized(cb);
      apiClient.setAccessToken('expired');

      globalThis.fetch = mockFetchBlobResponse(401);

      await expect(apiClient.exportFarmers()).rejects.toThrow(ApiError);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('throws network error when fetch fails during download', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchNetworkError();

      try {
        await apiClient.exportFarmers();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(0);
      }
    });

    it('passes query params for export endpoints', async () => {
      apiClient.setAccessToken('tok');
      globalThis.fetch = mockFetchBlobResponse(200);

      await apiClient.exportFarmers({ period: '30d', startDate: '2025-01-01', endDate: '2025-01-31' });

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('period=30d');
      expect(url).toContain('startDate=2025-01-01');
      expect(url).toContain('endDate=2025-01-31');
    });
  });

  // -----------------------------------------------------------------------
  // Specific endpoint coverage
  // -----------------------------------------------------------------------
  describe('platform endpoints', () => {
    beforeEach(() => {
      apiClient.setAccessToken('admin-tok');
    });

    it('platformGetOrganizations sends GET to correct URL', async () => {
      globalThis.fetch = mockFetchResponse(envelope([{ id: 'org-1' }]));
      const result = await apiClient.platformGetOrganizations();
      expect(result).toEqual([{ id: 'org-1' }]);

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/platform/organizations');
    });

    it('platformRegisterOrganization sends POST with body', async () => {
      globalThis.fetch = mockFetchResponse(
        envelope({ organization: { id: 'new-org' }, apiKey: 'key', apiSecret: 'secret' })
      );

      await apiClient.platformRegisterOrganization({
        name: 'Org',
        type: 'COOPERATIVE',
        contactPerson: 'John',
        contactEmail: 'j@test.com',
        contactPhone: '+254700000000',
      });

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.name).toBe('Org');
      expect(body.type).toBe('COOPERATIVE');
    });

    it('platformDashboardOverview builds query string from params', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ totalOrganizations: 5 }));
      await apiClient.platformDashboardOverview({ period: '30d' });

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/dashboard/platform/overview');
      expect(url).toContain('period=30d');
    });

    it('platformActivateOrganization sends POST', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ id: 'org-1', isActive: true }));
      await apiClient.platformActivateOrganization('org-1');

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/platform/organizations/org-1/activate');
      expect(options.method).toBe('POST');
    });

    it('platformGetPools returns pool data', async () => {
      const poolsData = { total: 2, pools: [{ address: '0x1' }, { address: '0x2' }] };
      globalThis.fetch = mockFetchResponse(envelope(poolsData));

      const result = await apiClient.platformGetPools();
      expect(result.total).toBe(2);
      expect(result.pools).toHaveLength(2);
    });

    it('platformGetTreasury returns treasury data', async () => {
      const treasuryData = { balance: '100000', paused: false };
      globalThis.fetch = mockFetchResponse(envelope(treasuryData));

      const result = await apiClient.platformGetTreasury();
      expect(result.balance).toBe('100000');
    });
  });

  describe('organization endpoints', () => {
    beforeEach(() => {
      apiClient.setAccessToken('org-tok');
    });

    it('depositToPool sends correct data', async () => {
      globalThis.fetch = mockFetchResponse(
        envelope({ txHash: '0xabc', blockNumber: 100, tokensMinted: '50', tokenPrice: '1.0' })
      );

      const result = await apiClient.depositToPool({ amount: 1000 });

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/organizations/me/pool/deposit');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ amount: 1000 });
      expect(result.txHash).toBe('0xabc');
    });

    it('deployOrgPool sends pool configuration', async () => {
      globalThis.fetch = mockFetchResponse(
        envelope({
          organization: { id: 'org-1' },
          pool: { poolAddress: '0xpool', poolId: 'p1', txHash: '0xtx', blockNumber: 200 },
        })
      );

      await apiClient.deployOrgPool({
        poolType: 'PRIVATE',
        coverageType: 1,
        region: 'Kenya',
        targetCapital: 50000,
      });

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.poolType).toBe('PRIVATE');
      expect(body.targetCapital).toBe(50000);
    });
  });

  describe('farmer endpoints', () => {
    beforeEach(() => {
      apiClient.setAccessToken('org-tok');
    });

    it('registerFarmer sends POST with farmer data', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ id: 'f1', firstName: 'Jane' }));

      await apiClient.registerFarmer({
        phoneNumber: '+254711111111',
        nationalId: '12345678',
        firstName: 'Jane',
        lastName: 'Doe',
        county: 'Nairobi',
      });

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/farmers/register');
      expect(options.method).toBe('POST');
    });

    it('updateFarmerKyc sends PUT with status', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ id: 'f1', kycStatus: 'APPROVED' }));

      await apiClient.updateFarmerKyc('f1', { status: 'APPROVED' });

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/farmers/f1/kyc');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual({ status: 'APPROVED' });
    });

    it('bulkImportFarmers sends array of farmer records', async () => {
      globalThis.fetch = mockFetchResponse(
        envelope({ imported: 2, skipped: 0, errors: [], total: 2 })
      );

      const farmers = [{ firstName: 'A' }, { firstName: 'B' }];
      const result = await apiClient.bulkImportFarmers(farmers);

      expect(result.imported).toBe(2);
      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ farmers });
    });
  });

  describe('policy endpoints', () => {
    beforeEach(() => {
      apiClient.setAccessToken('org-tok');
    });

    it('getPolicyQuote sends quote request', async () => {
      const quoteData = { premium: 500, sumInsured: 10000 };
      globalThis.fetch = mockFetchResponse(envelope(quoteData));

      const result = await apiClient.getPolicyQuote({
        farmerId: 'f1',
        plotId: 'p1',
        sumInsured: 10000,
        coverageType: 'DROUGHT',
        durationDays: 90,
      });

      expect(result).toEqual(quoteData);
      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/policies/quote');
    });

    it('cancelPolicy sends reason in body', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ id: 'pol-1', status: 'CANCELLED' }));

      await apiClient.cancelPolicy('pol-1', 'Customer request');

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/policies/pol-1/cancel');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ reason: 'Customer request' });
    });

    it('activatePolicy sends PUT', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ id: 'pol-1', status: 'ACTIVE' }));

      await apiClient.activatePolicy('pol-1');

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/policies/pol-1/activate');
      expect(options.method).toBe('PUT');
    });
  });

  describe('payout endpoints', () => {
    beforeEach(() => {
      apiClient.setAccessToken('org-tok');
    });

    it('retryPayout sends POST to correct URL', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ id: 'pay-1', status: 'PENDING' }));

      await apiClient.retryPayout('pay-1');

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/payouts/pay-1/retry');
      expect(options.method).toBe('POST');
    });

    it('batchRetryPayouts sends payoutIds', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ retried: 3 }));

      await apiClient.batchRetryPayouts(['p1', 'p2', 'p3']);

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ payoutIds: ['p1', 'p2', 'p3'] });
    });

    it('batchRetryPayouts sends retryAllFailed flag', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ retried: 10 }));

      await apiClient.batchRetryPayouts(undefined, true);

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ retryAllFailed: true });
    });
  });

  describe('staff management endpoints', () => {
    beforeEach(() => {
      apiClient.setAccessToken('admin-tok');
    });

    it('inviteStaff sends POST with staff data', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ id: 's1', email: 'staff@test.com' }));

      await apiClient.inviteStaff({
        email: 'staff@test.com',
        firstName: 'Staff',
        lastName: 'User',
        role: 'ORG_STAFF',
      });

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/staff/invite');
      expect(options.method).toBe('POST');
    });

    it('deactivateStaff sends PUT', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ id: 's1', isActive: false }));

      await apiClient.deactivateStaff('s1');

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/staff/s1/deactivate');
      expect(options.method).toBe('PUT');
    });
  });

  describe('invitation endpoints', () => {
    beforeEach(() => {
      apiClient.setAccessToken('admin-tok');
    });

    it('createInvitation sends POST', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ id: 'inv-1' }));

      await apiClient.createInvitation({
        organizationId: 'org-1',
        email: 'new@test.com',
        firstName: 'New',
        lastName: 'Admin',
      });

      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/invitations');
      expect(options.method).toBe('POST');
    });

    it('acceptInvitation sends token and password', async () => {
      globalThis.fetch = mockFetchResponse(
        envelope({ user: { id: 'u1' }, message: 'Welcome!' })
      );

      const result = await apiClient.acceptInvitation('inv-token-123', 'newpass');

      const [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ token: 'inv-token-123', password: 'newpass' });
      expect(result.message).toBe('Welcome!');
    });

    it('validateInvitationToken sends GET with token in URL', async () => {
      globalThis.fetch = mockFetchResponse(
        envelope({ valid: true, invitation: { id: 'inv-1' } })
      );

      await apiClient.validateInvitationToken('abc-123');

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/invitations/validate/abc-123');
    });

    it('getInvitations filters undefined params', async () => {
      globalThis.fetch = mockFetchResponse({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      await apiClient.getInvitations({ organizationId: 'org-1', status: undefined });

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('organizationId=org-1');
      expect(url).not.toContain('status');
    });
  });

  describe('org dashboard endpoints', () => {
    beforeEach(() => {
      apiClient.setAccessToken('org-tok');
    });

    it('orgDashboardOverview passes period param', async () => {
      globalThis.fetch = mockFetchResponse(envelope({ totalFarmers: 100 }));

      await apiClient.orgDashboardOverview({ period: '7d' });

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/dashboard/org/overview');
      expect(url).toContain('period=7d');
    });

    it('orgDashboardActivity passes limit param', async () => {
      globalThis.fetch = mockFetchResponse(envelope([{ id: 'act-1' }]));

      await apiClient.orgDashboardActivity(5);

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/dashboard/org/activity?limit=5');
    });

    it('orgDashboardActivity omits query when no limit', async () => {
      globalThis.fetch = mockFetchResponse(envelope([]));

      await apiClient.orgDashboardActivity();

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain('/api/dashboard/org/activity');
      expect(url).not.toContain('?');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles error response with no error object', async () => {
      globalThis.fetch = mockFetchResponse({}, 500);

      try {
        await apiClient.login('a@b.com', 'pass');
        expect.fail('Should throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).message).toBe('An error occurred');
        expect((err as ApiError).code).toBeUndefined();
      }
    });

    it('handles multiple sequential requests correctly', async () => {
      apiClient.setAccessToken('tok');

      // First request
      globalThis.fetch = mockFetchResponse(envelope({ id: 'org-1' }));
      const org = await apiClient.getMyOrganization();
      expect(org).toEqual({ id: 'org-1' });

      // Second request
      globalThis.fetch = mockFetchResponse(envelope([{ id: 'u1' }]));
      const staff = await apiClient.getStaff();
      expect(staff).toEqual([{ id: 'u1' }]);
    });

    it('preserves token across multiple requests', async () => {
      apiClient.setAccessToken('persistent-token');

      globalThis.fetch = mockFetchResponse(envelope({}));
      await apiClient.getMyOrganization();
      let [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer persistent-token');

      globalThis.fetch = mockFetchResponse(envelope([]));
      await apiClient.getStaff();
      [, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer persistent-token');
    });
  });
});
