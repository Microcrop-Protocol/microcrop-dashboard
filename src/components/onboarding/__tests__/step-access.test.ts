/**
 * The reachability rules on their own. Each locked step names the EARLIEST thing missing, and
 * the only step a purchase locks is the boundary walk — everything else stays viewable, read-only.
 */
import { describe, expect, it } from 'vitest';
import { fieldStepLockReason, livestockStepLockReason, type FieldStepId } from '../step-access';

const approved = { kycStatus: 'APPROVED' };
const pending = { kycStatus: 'PENDING' };

describe('fieldStepLockReason', () => {
  const empty = { farmer: null, plot: null, boundaryResult: null, quote: null, policy: null };

  it('opens only registration on a fresh wizard', () => {
    const open = (['register', 'consent', 'kyc', 'plot', 'walk', 'review', 'quote', 'purchase', 'payment'] as FieldStepId[])
      .filter((id) => fieldStepLockReason(id, empty) == null);
    expect(open).toEqual(['register']);
    expect(fieldStepLockReason('quote', empty)).toBe('Register the farmer first');
  });

  it('opens consent and KYC once a farmer exists, and the plot only once they are verified', () => {
    expect(fieldStepLockReason('consent', { ...empty, farmer: pending })).toBeNull();
    expect(fieldStepLockReason('kyc', { ...empty, farmer: pending })).toBeNull();
    expect(fieldStepLockReason('plot', { ...empty, farmer: pending })).toBe("Verify the farmer's identity first");
    expect(fieldStepLockReason('plot', { ...empty, farmer: approved })).toBeNull();
  });

  it('needs the plot for the walk, the walk for review and quote, and a quote for purchase', () => {
    const s = { ...empty, farmer: approved, plot: {} };
    expect(fieldStepLockReason('walk', s)).toBeNull();
    expect(fieldStepLockReason('review', s)).toBe('Walk the plot boundary first');
    expect(fieldStepLockReason('quote', s)).toBe('Walk the plot boundary first');
    const walked = { ...s, boundaryResult: {} };
    expect(fieldStepLockReason('quote', walked)).toBeNull();
    expect(fieldStepLockReason('purchase', walked)).toBe('Get a premium quote first');
    expect(fieldStepLockReason('purchase', { ...walked, quote: {} })).toBeNull();
    expect(fieldStepLockReason('payment', { ...walked, quote: {} })).toBe('Purchase the policy first');
  });

  it('locks only the boundary walk once the policy exists', () => {
    const bought = { farmer: approved, plot: {}, boundaryResult: {}, quote: {}, policy: {} };
    expect(fieldStepLockReason('walk', bought)).toMatch(/policy has been purchased/);
    for (const id of ['register', 'consent', 'kyc', 'plot', 'review', 'quote', 'purchase', 'payment'] as FieldStepId[]) {
      expect(fieldStepLockReason(id, bought)).toBeNull();
    }
  });
});

describe('livestockStepLockReason', () => {
  const empty = { farmer: null, herd: null, quote: null, policy: null };

  it('walks the same chain: pastoralist, verification, herd, quote, policy', () => {
    expect(livestockStepLockReason('consent', empty)).toBe('Register the pastoralist first');
    expect(livestockStepLockReason('herd', { ...empty, farmer: pending })).toBe("Verify the pastoralist's identity first");
    expect(livestockStepLockReason('quote', { ...empty, farmer: approved })).toBe('Register the herd first');
    expect(livestockStepLockReason('purchase', { ...empty, farmer: approved, herd: {} })).toBe('Calculate the premium first');
    expect(livestockStepLockReason('purchase', { ...empty, farmer: approved, herd: {}, quote: {} })).toBeNull();
    expect(livestockStepLockReason('payment', { ...empty, farmer: approved, herd: {}, quote: {} })).toBe('Create the policy first');
    expect(livestockStepLockReason('payment', { farmer: approved, herd: {}, quote: {}, policy: {} })).toBeNull();
  });
});
