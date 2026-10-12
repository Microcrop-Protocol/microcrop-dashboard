/**
 * The catalogue refusals end to end through the client: a 409/400 with an OBJECT `details`
 * reaches `ApiError.context` (not `details`, which stays an array), and getErrorMessage turns it
 * into copy naming the crop and the country — never the generic 409 "conflicts with something".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '@/lib/api/client';
import { getErrorMessage } from '@/lib/error-messages';

function mockFetch(body: unknown, status: number) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('catalogue refusals through the client', () => {
  it('routes an object-form details to ApiError.context and leaves details undefined', async () => {
    globalThis.fetch = mockFetch(
      {
        success: false,
        error: {
          code: 'PRODUCT_NOT_OFFERED',
          message: 'Product not offered',
          details: { countryCode: 'KE', line: 'CROP', item: 'WHEAT', status: 'COMING_SOON' },
        },
      },
      409,
    ) as unknown as typeof fetch;

    const err = await apiClient
      .getPolicyQuote({
        farmerId: 'f1', plotId: 'p1', sumInsured: 10000, coverageType: 'DROUGHT', durationDays: 90,
      })
      .catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.details).toBeUndefined();
    expect(err.context).toEqual({ countryCode: 'KE', line: 'CROP', item: 'WHEAT', status: 'COMING_SOON' });
    expect(getErrorMessage(err)).toBe(
      'Wheat cover is coming soon in Kenya and cannot be quoted or sold yet.',
    );
  });

  it('keeps an array details on ApiError.details, unchanged', async () => {
    globalThis.fetch = mockFetch(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [{ field: 'cropType', message: 'cropType is required' }],
        },
      },
      400,
    ) as unknown as typeof fetch;

    const err = await apiClient.createPlot('f1', {
      name: 'A', latitude: 1, longitude: 1, acreage: 1, cropType: '',
    }).catch((e) => e);

    expect(err.details).toEqual([{ field: 'cropType', message: 'cropType is required' }]);
    expect(err.context).toBeUndefined();
  });

  it('words PRODUCT_NOT_IN_MARKET on plot creation', () => {
    const err = new ApiError('Not in market', 400, 'PRODUCT_NOT_IN_MARKET', undefined, {
      countryCode: 'GH', line: 'CROP', item: 'TEA',
    });
    expect(getErrorMessage(err)).toBe(
      'Tea is not in the product list in Ghana, so a new plot cannot be registered with it. Choose one from the list.',
    );
  });

  it('words PRICING_NOT_CONFIGURED as a 409 that is not "a conflict"', () => {
    const err = new ApiError('Pricing not configured', 409, 'PRICING_NOT_CONFIGURED', undefined, {
      countryCode: 'GH', line: 'CROP', item: 'GROUNDNUT',
    });
    const message = getErrorMessage(err);
    expect(message).toMatch(/Pricing for groundnut is not configured in Ghana yet/);
    expect(message).not.toMatch(/conflicts/);
  });

  it('falls back to static copy when a refusal arrives without its details', () => {
    expect(getErrorMessage(new ApiError('x', 409, 'PRODUCT_NOT_OFFERED'))).toBe(
      "That product isn't offered in your market, so it can't be quoted or sold.",
    );
    expect(getErrorMessage(new ApiError('x', 400, 'PRODUCT_NOT_IN_MARKET'))).toMatch(
      /isn't in your market's product list/,
    );
    expect(getErrorMessage(new ApiError('x', 409, 'PRICING_NOT_CONFIGURED'))).toMatch(
      /Pricing for that product isn't configured/,
    );
  });
});

describe('getCatalogue', () => {
  it('reads GET /api/catalogue and unwraps the envelope', async () => {
    const fetchMock = mockFetch({ success: true, data: { markets: [] } }, 200);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiClient.getCatalogue()).resolves.toEqual({ markets: [] });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/catalogue$/);
  });
});
