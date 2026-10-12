/**
 * KYB REVIEW MARKET — a reviewer must see which market an organization is in, because the
 * market decides the regulator that licenses it. An organization with no recognised market is
 * UNKNOWN, never Kenya.
 */
import { describe, it, expect } from 'vitest';
import { kybReviewMarket } from '@/lib/kyb-review';

describe('kybReviewMarket', () => {
  it("names a Ghanaian organization's country and regulator", () => {
    expect(kybReviewMarket({ countryCode: 'GH', regulator: 'NIC' })).toEqual({
      known: true,
      countryCode: 'GH',
      countryName: 'Ghana',
      regulator: 'NIC',
    });
  });

  it("prefers the server's regulator, and uses the mirror only when the server sent none", () => {
    expect(kybReviewMarket({ countryCode: 'KE', regulator: 'IRA-KE' }).regulator).toBe('IRA-KE');
    expect(kybReviewMarket({ countryCode: 'KE', regulator: null }).regulator).toBe('IRA');
  });

  it('does not default a missing country to Kenya', () => {
    expect(kybReviewMarket({ countryCode: null, regulator: null })).toEqual({
      known: false,
      countryCode: null,
      countryName: null,
      regulator: null,
    });
  });

  it('shows an unrecognised country as its code, not as a known market', () => {
    const market = kybReviewMarket({ countryCode: 'ug' });
    expect(market.known).toBe(false);
    expect(market.countryName).toBe('UG');
    expect(market.regulator).toBeNull();
  });
});
