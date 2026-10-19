/**
 * KYB REVIEW MARKET — a reviewer must see which market an organization is in, because the
 * market decides the regulator that licenses it. An organization with no recognised market is
 * UNKNOWN, never Kenya.
 */
import { describe, it, expect } from 'vitest';
import { kybReviewMarket } from '@/lib/kyb-review';

describe('kybReviewMarket', () => {
  it("names a Ghanaian organization's country, regulator and division label", () => {
    expect(
      kybReviewMarket({ countryCode: 'GH', regulator: 'NIC', regulatorName: 'National Insurance Commission' }),
    ).toEqual({
      known: true,
      countryCode: 'GH',
      countryName: 'Ghana',
      regulator: 'NIC',
      regulatorName: 'National Insurance Commission',
      level1Label: 'Region',
    });
  });

  it("reads exactly the `regulator` field the server sends — a null it sent is kept", () => {
    // kyb.service.listOrgKybReviews sends `regulator` (the short code) and sends null on purpose
    // when it will not name one. That null is an answer, not a gap for the mirror to fill.
    expect(kybReviewMarket({ countryCode: 'KE', regulator: 'IRA-KE' }).regulator).toBe('IRA-KE');
    expect(kybReviewMarket({ countryCode: 'KE', regulator: null }).regulator).toBeNull();
  });

  it('uses the mirror only when an older server did not send the field at all', () => {
    expect(kybReviewMarket({ countryCode: 'KE' }).regulator).toBe('IRA');
    expect(kybReviewMarket({ countryCode: 'GH', regulator: undefined }).regulator).toBe('NIC');
  });

  it('does not default a missing country to Kenya — not even its "County" label', () => {
    expect(kybReviewMarket({ countryCode: null, regulator: null })).toEqual({
      known: false,
      countryCode: null,
      countryName: null,
      regulator: null,
      regulatorName: null,
      level1Label: 'County / Region',
    });
  });

  it('shows an unrecognised country as its code, not as a known market', () => {
    const market = kybReviewMarket({ countryCode: 'zz' });
    expect(market.known).toBe(false);
    expect(market.countryName).toBe('ZZ');
    expect(market.regulator).toBeNull();
    expect(market.level1Label).not.toBe('County');
  });
});
