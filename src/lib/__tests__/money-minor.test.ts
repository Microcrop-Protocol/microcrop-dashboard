/**
 * MONEY IN MINOR UNITS — the figure a partner owes a farmer.
 *
 * Everything here is string/BigInt arithmetic on purpose. `Number('100000.005')` is already
 * inexact before anything could inspect it, and a determination amount is a real obligation to
 * a real smallholder, so a display rounding error is a wrong number on an insurance claim.
 *
 * The round-trip property is the one that matters commercially: a partner who types back
 * exactly the figure the screen quoted must produce exactly the integer the backend derived.
 * Rounding half-up on the way in would yield one minor unit ABOVE the determined amount for
 * some inputs, which the server refuses as "more than MicroCrop determined" — an error an
 * operator could never diagnose from the screen.
 */
import { describe, it, expect } from 'vitest';
import {
  formatMinor,
  toMinorUnits,
  compareMinor,
  formatMoneyMinor,
  formatBasisPoints,
} from '../money-minor';

describe('formatMinor', () => {
  it('places the decimal point at the currency scale', () => {
    expect(formatMinor('1650000', 2)).toBe('16500.00');
    expect(formatMinor('1', 2)).toBe('0.01');
    expect(formatMinor('0', 2)).toBe('0.00');
  });

  it('handles a zero-exponent currency with no stray point', () => {
    expect(formatMinor('16500', 0)).toBe('16500');
  });

  it('pads when the value is shorter than the scale', () => {
    expect(formatMinor('5', 6)).toBe('0.000005');
  });

  it('is exact far beyond 2^53, where Number silently loses digits', () => {
    const huge = '9007199254740993123';
    expect(formatMinor(huge, 2)).toBe('90071992547409931.23');
  });

  it('rejects a non-integer input rather than guessing', () => {
    expect(() => formatMinor('12.5', 2)).toThrow();
    expect(() => formatMinor('abc', 2)).toThrow();
  });
});

describe('toMinorUnits', () => {
  it('scales a plain decimal', () => {
    expect(toMinorUnits('16500.00', 2)).toBe('1650000');
    expect(toMinorUnits('16500', 2)).toBe('1650000');
    expect(toMinorUnits('0.07', 2)).toBe('7');
  });

  it('TRUNCATES toward zero rather than rounding', () => {
    // Rounding half-up would give '1651' — one minor unit above what MicroCrop determined,
    // which the server refuses.
    expect(toMinorUnits('16.509', 2)).toBe('1650');
    expect(toMinorUnits('16.505', 2)).toBe('1650');
    expect(toMinorUnits('0.999', 2)).toBe('99');
  });

  it('emits the canonical spelling the server regex accepts', () => {
    // The server pattern is ^(0|[1-9]\d*)$ — '007' and '7' must not both denote 7.
    expect(toMinorUnits('007.00', 2)).toBe('700');
    expect(toMinorUnits('0', 2)).toBe('0');
    expect(toMinorUnits('0.00', 2)).toBe('0');
    expect(toMinorUnits('16500.00', 2)).not.toMatch(/^0\d/);
  });

  it('refuses input a human might paste but the server would reject', () => {
    for (const bad of ['', '  ', '-5.00', '+5.00', '1e3', 'KES 16500', '16,500.00', '16.5.0', 'abc']) {
      expect(() => toMinorUnits(bad, 2)).toThrow();
    }
  });

  it('round-trips the quoted figure exactly', () => {
    for (const minor of ['1650000', '1', '0', '999999999999999999999']) {
      expect(toMinorUnits(formatMinor(minor, 2), 2)).toBe(minor);
    }
  });
});

describe('compareMinor is exact at any magnitude', () => {
  it('orders correctly past the float boundary', () => {
    expect(compareMinor('9007199254740993', '9007199254740992')).toBe(1);
    expect(compareMinor('1650000', '1650000')).toBe(0);
    expect(compareMinor('1', '2')).toBe(-1);
  });
});

describe('formatMoneyMinor', () => {
  it('renders currency and thousands grouping', () => {
    expect(formatMoneyMinor('1650000', 'KES', 2)).toBe('KES 16,500.00');
    expect(formatMoneyMinor('100', 'KES', 2)).toBe('KES 1.00');
  });

  it('shows an em dash for an absent amount rather than a misleading zero', () => {
    // A determination whose amount could not be derived must never render as "KES 0.00" —
    // that is a specific, wrong claim about what the partner owes.
    expect(formatMoneyMinor(null, 'KES', 2)).toBe('—');
    expect(formatMoneyMinor(undefined, 'KES', 2)).toBe('—');
  });

  it('degrades honestly on an unknown scale instead of printing a wrong figure', () => {
    const out = formatMoneyMinor('1650000', 'XYZ', null);
    expect(out).toContain('1650000');
    expect(out).toContain('minor units');
    expect(out).not.toBe('XYZ 16,500.00');
  });

  it('groups every digit of a very large amount', () => {
    expect(formatMoneyMinor('9007199254740993123', 'KES', 2)).toBe('KES 90,071,992,547,409,931.23');
  });
});

describe('formatBasisPoints', () => {
  it('converts integer bp to a percentage', () => {
    expect(formatBasisPoints(10000)).toBe('100%');
    expect(formatBasisPoints(1650)).toBe('16.50%');
    expect(formatBasisPoints(0)).toBe('0%');
  });

  it('shows an em dash rather than NaN%', () => {
    expect(formatBasisPoints(null)).toBe('—');
    expect(formatBasisPoints(undefined)).toBe('—');
    expect(formatBasisPoints(NaN)).toBe('—');
  });
});
