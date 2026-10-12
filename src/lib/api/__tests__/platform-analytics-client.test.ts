import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../client';
import { api } from '../index';

/**
 * The platform analytics calls used to send NOTHING — no market, no dates, no granularity — so
 * the date picker and granularity select on every analytics page were decoration. These pin that
 * every filter reaches the wire, that an unset one is absent rather than the string "undefined",
 * and that the api layer hands pages the normalised view, not the wire shape.
 */
describe('platform analytics requests', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stubFetch(data: unknown = {}) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  const url = (fetchMock: ReturnType<typeof vi.fn>) => new URL(String(fetchMock.mock.calls[0][0]));

  it.each([
    ['platformAnalyticsRevenue', 'revenue'],
    ['platformAnalyticsPolicies', 'policies'],
    ['platformAnalyticsFarmers', 'farmers'],
    ['platformAnalyticsPayouts', 'payouts'],
  ] as const)('%s sends countryCode, dates and granularity', async (method, path) => {
    const fetchMock = stubFetch();
    await apiClient[method]({
      countryCode: 'GH',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-30T23:59:59.999Z',
      granularity: 'weekly',
    });
    const u = url(fetchMock);
    expect(u.pathname).toBe(`/api/dashboard/platform/analytics/${path}`);
    expect(u.searchParams.get('countryCode')).toBe('GH');
    expect(u.searchParams.get('startDate')).toBe('2026-09-01T00:00:00.000Z');
    expect(u.searchParams.get('endDate')).toBe('2026-09-30T23:59:59.999Z');
    expect(u.searchParams.get('granularity')).toBe('weekly');
  });

  it('omits an unset market rather than sending "undefined"', async () => {
    const fetchMock = stubFetch();
    await apiClient.platformDashboardOverview({ countryCode: undefined, startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-30T00:00:00.000Z' });
    const u = url(fetchMock);
    expect(u.searchParams.has('countryCode')).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('undefined');
  });

  it('sends the market on the damage-assessments call too', async () => {
    const fetchMock = stubFetch();
    await apiClient.platformAnalyticsDamage({ countryCode: 'KE' });
    expect(url(fetchMock).searchParams.get('countryCode')).toBe('KE');
  });

  it('getCatalogue reads /api/catalogue', async () => {
    const fetchMock = stubFetch({ markets: [] });
    const result = await apiClient.getCatalogue();
    expect(url(fetchMock).pathname).toBe('/api/catalogue');
    expect(result).toEqual({ markets: [] });
  });

  it('api.getPlatformStats hands the page the normalised nested shape', async () => {
    stubFetch({
      organizations: { total: 3, active: 2, inactive: 1 },
      financials: { totalPayoutsUsdc: '10', byCurrency: [{ countryCode: 'KE', currency: 'KES', totalPremiums: '5', totalFees: '1' }] },
    });
    const stats = await api.getPlatformStats({ countryCode: 'KE' });
    expect(stats.organizations.total).toBe(3);
    expect(stats.financials.totalPayoutsUsdc).toBe(10);
    expect(stats.financials.byCurrency[0].totalPremiums).toBe(5);
  });

  it('api.getRevenueAnalytics passes its filters through and normalises the answer', async () => {
    const fetchMock = stubFetch({ countryCode: 'GH', currency: 'GHS', totals: { totalPremiums: '12' } });
    const view = await api.getRevenueAnalytics({ countryCode: 'GH', granularity: 'monthly' });
    expect(url(fetchMock).searchParams.get('granularity')).toBe('monthly');
    expect(view.totals.premiums).toBe(12);
    expect(view.currency).toBe('GHS');
  });
});
