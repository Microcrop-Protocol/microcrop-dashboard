/**
 * The submit-time prerequisite rules on their own. Each action lists EVERYTHING it still needs,
 * earliest first, each item pointing at the step that provides it; the stepper ticks a step only
 * when its record really exists.
 */
import { describe, expect, it } from 'vitest';
import {
  fieldActionMissing, fieldStepDone, livestockActionMissing, livestockStepDone, quoteInputsMatch,
  type FieldStepId, type LivestockStepId,
} from '../step-access';

const approved = { kycStatus: 'APPROVED' };
const pending = { kycStatus: 'PENDING' };
const steps = (list: { step: string }[]) => list.map((m) => m.step);

describe('fieldActionMissing', () => {
  const empty = { farmer: null, plot: null, boundaryResult: null, quote: null, policy: null };

  it('lets only registration through on a fresh wizard, and lists every gap for the rest', () => {
    expect(fieldActionMissing('register', empty)).toEqual([]);
    expect(steps(fieldActionMissing('kyc', empty))).toEqual(['register']);
    expect(steps(fieldActionMissing('plot', empty))).toEqual(['register', 'kyc']);
    expect(steps(fieldActionMissing('walk', empty))).toEqual(['register', 'kyc', 'plot']);
    expect(steps(fieldActionMissing('quote', empty))).toEqual(['register', 'kyc', 'plot', 'walk']);
    expect(steps(fieldActionMissing('purchase', empty))).toEqual(['register', 'kyc', 'plot', 'walk', 'quote']);
    expect(steps(fieldActionMissing('payment', empty))).toEqual(['register', 'kyc', 'plot', 'walk', 'quote', 'purchase']);
  });

  it('phrases each gap as the thing to do', () => {
    expect(fieldActionMissing('quote', empty).map((m) => m.label)).toEqual([
      'Register the farmer', "Verify the farmer's identity", 'Create the plot', 'Walk the plot boundary',
    ]);
  });

  it('keeps verification a requirement for the plot, and the walk one for the quote', () => {
    expect(steps(fieldActionMissing('plot', { ...empty, farmer: pending }))).toEqual(['kyc']);
    expect(fieldActionMissing('plot', { ...empty, farmer: approved })).toEqual([]);
    const planted = { ...empty, farmer: approved, plot: {} };
    expect(fieldActionMissing('walk', planted)).toEqual([]);
    expect(steps(fieldActionMissing('quote', planted))).toEqual(['walk']);
    expect(fieldActionMissing('quote', { ...planted, boundaryResult: {} })).toEqual([]);
  });

  it('asks for a new quote when the coverage changed since the last one', () => {
    const walked = { farmer: approved, plot: {}, boundaryResult: {}, quote: null, policy: null };
    expect(fieldActionMissing('purchase', walked)[0].label).toBe('Get a premium quote');
    expect(fieldActionMissing('purchase', { ...walked, staleQuote: true })[0].label).toMatch(/^Get a new quote/);
    expect(fieldActionMissing('purchase', { ...walked, quote: {} })).toEqual([]);
    expect(steps(fieldActionMissing('payment', { ...walked, quote: {} }))).toEqual(['purchase']);
  });

  it('has nothing missing anywhere once the policy exists', () => {
    const bought = { farmer: approved, plot: {}, boundaryResult: {}, quote: null, policy: {} };
    for (const id of ['register', 'consent', 'kyc', 'plot', 'walk', 'review', 'quote', 'purchase', 'payment'] as FieldStepId[]) {
      expect(fieldActionMissing(id, bought)).toEqual([]);
    }
  });
});

describe('fieldStepDone', () => {
  const none = () => false;
  const all = () => true;

  it('ticks a step only when its record exists', () => {
    const empty = { farmer: null, plot: null, boundaryResult: null, quote: null, policy: null };
    for (const id of ['register', 'consent', 'kyc', 'plot', 'walk', 'review', 'quote', 'purchase', 'payment'] as FieldStepId[]) {
      expect(fieldStepDone(id, empty, all)).toBe(false);
    }
    expect(fieldStepDone('kyc', { ...empty, farmer: pending }, all)).toBe(false);
    expect(fieldStepDone('kyc', { ...empty, farmer: approved }, all)).toBe(true);
  });

  it('ticks consent and review once visited with their data in place', () => {
    const s = { farmer: approved, plot: {}, boundaryResult: {}, quote: null, policy: null };
    expect(fieldStepDone('consent', s, none)).toBe(false);
    expect(fieldStepDone('consent', s, all)).toBe(true);
    expect(fieldStepDone('review', s, all)).toBe(true);
    expect(fieldStepDone('review', { ...s, boundaryResult: null }, all)).toBe(false);
    expect(fieldStepDone('payment', { ...s, policy: {} }, all)).toBe(false);
    expect(fieldStepDone('payment', { ...s, policy: {}, paymentCompleted: true }, all)).toBe(true);
  });
});

describe('livestockActionMissing', () => {
  const empty = { farmer: null, herd: null, quote: null, policy: null };

  it('walks the same chain: pastoralist, verification, herd, quote, policy', () => {
    expect(livestockActionMissing('register', empty)).toEqual([]);
    expect(steps(livestockActionMissing('herd', empty))).toEqual(['register', 'kyc']);
    expect(steps(livestockActionMissing('herd', { ...empty, farmer: pending }))).toEqual(['kyc']);
    expect(steps(livestockActionMissing('quote', { ...empty, farmer: approved }))).toEqual(['herd']);
    expect(steps(livestockActionMissing('purchase', { ...empty, farmer: approved, herd: {} }))).toEqual(['quote']);
    expect(livestockActionMissing('purchase', { ...empty, farmer: approved, herd: {}, quote: {} })).toEqual([]);
    expect(steps(livestockActionMissing('payment', { ...empty, farmer: approved, herd: {}, quote: {} }))).toEqual(['purchase']);
    expect(steps(livestockActionMissing('payment', empty))).toEqual(['register', 'kyc', 'herd', 'quote', 'purchase']);
  });

  it('asks for a new quote when the season or peril changed', () => {
    const s = { farmer: approved, herd: {}, quote: null, policy: null, staleQuote: true };
    expect(livestockActionMissing('purchase', s)[0].label).toMatch(/^Get a new quote/);
  });

  it('ticks only steps whose record exists', () => {
    const empty2 = { farmer: null, herd: null, quote: null, policy: null };
    for (const id of ['register', 'consent', 'kyc', 'herd', 'quote', 'purchase', 'payment'] as LivestockStepId[]) {
      expect(livestockStepDone(id, empty2, () => true)).toBe(false);
    }
    expect(livestockStepDone('herd', { ...empty2, herd: {} }, () => false)).toBe(true);
  });
});

describe('quoteInputsMatch', () => {
  const quoted = { sumInsured: 10000, coverageType: 'DROUGHT', durationDays: 90 };

  it('matches the values the quote was calculated from, numbers and strings alike', () => {
    expect(quoteInputsMatch(quoted, quoted)).toBe(true);
    expect(quoteInputsMatch({ ...quoted, sumInsured: '10000' } as never, quoted)).toBe(true);
  });

  it('fails once any value moves, and when there is no quote', () => {
    expect(quoteInputsMatch({ ...quoted, sumInsured: 50000 }, quoted)).toBe(false);
    expect(quoteInputsMatch({ ...quoted, coverageType: 'FLOOD' }, quoted)).toBe(false);
    expect(quoteInputsMatch({ ...quoted, durationDays: undefined }, quoted)).toBe(false);
    expect(quoteInputsMatch(quoted, null)).toBe(false);
  });
});
