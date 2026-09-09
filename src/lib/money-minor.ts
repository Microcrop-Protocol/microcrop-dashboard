/**
 * MINOR-UNIT MONEY, for the partner settlement surfaces.
 *
 * A Tier 1 partner settles its farmer in the POLICY's own currency, off its own balance sheet.
 * Every money value on that path crosses the wire as an exact integer count of MINOR units in a
 * decimal STRING (`"1650000"` = KES 16,500.00) plus a pre-formatted human string. It is never a
 * JSON number: `Number.MAX_SAFE_INTEGER` is ~9.0e15, and a large UGX or IDR sum in minor units
 * gets close enough that a double would silently round a liability.
 *
 * So this module is BigInt-only and string-in/string-out. It mirrors
 * microcrop-backend/src/determination/amount-owed.js (`toMinorUnits`, `formatMinor`) exactly,
 * including the truncation direction, so an amount typed here round-trips to the same integer
 * the server derived rather than landing one minor unit away and failing the server's
 * "not more than we determined" bound for no visible reason.
 *
 * FAIL CLOSED ON SCALE. The exponent always comes from the server (`amountOwed.exponent`,
 * carried on the determination). It is never defaulted to 2 and never inferred from the
 * currency code here: the backend refuses to guess a scale for a monetary obligation, and a
 * dashboard that guessed would be the one place the guess could enter the record.
 */

/** The exponent could not be established. Callers must refuse rather than assume a scale. */
export class UnknownScaleError extends Error {}

/** The operator's input is not a monetary amount we can read exactly. */
export class InvalidAmountError extends Error {}

function assertExponent(exponent: number | null | undefined): asserts exponent is number {
  if (
    exponent === null ||
    exponent === undefined ||
    !Number.isInteger(exponent) ||
    exponent < 0 ||
    exponent > 8
  ) {
    throw new UnknownScaleError(
      'No minor-unit scale is available for this currency, so the amount cannot be converted ' +
        'exactly. MicroCrop does not guess a scale for a monetary obligation.',
    );
  }
}

/**
 * Minor units -> a fixed-notation decimal string. Mirrors the backend `formatMinor`.
 *
 * @param amountMinor decimal string of minor units (may be negative)
 */
export function formatMinor(amountMinor: string, exponent: number): string {
  assertExponent(exponent);
  let value: bigint;
  try {
    value = BigInt(String(amountMinor).trim());
  } catch {
    throw new InvalidAmountError(`Cannot read minor units from "${amountMinor}"`);
  }
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(exponent + 1, '0');
  const whole = digits.slice(0, digits.length - exponent);
  const fraction = exponent > 0 ? `.${digits.slice(digits.length - exponent)}` : '';
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

/**
 * A typed decimal amount -> minor units, truncating toward zero at the currency's scale.
 *
 * Truncation, not rounding, and deliberately: it matches the backend derivation, so a partner
 * who types back exactly the figure we told them they owe produces exactly the integer we
 * derived. Rounding half-up here would produce a value ONE minor unit above the determined
 * amount for some inputs, which the server refuses as "more than MicroCrop determined" — an
 * error the operator could never diagnose from the screen.
 *
 * Rejects the empty string, a sign, exponent notation and anything else that is not plain
 * fixed-notation digits. `Number()` is never involved: `Number('100000.005')` is already
 * inexact before we could look at it.
 *
 * @returns a canonical decimal string of minor units, with no leading zeros ('0' for zero) —
 *   the exact spelling the server's `^(0|[1-9]\d*)$` accepts.
 */
export function toMinorUnits(text: string, exponent: number): string {
  assertExponent(exponent);
  const match = /^\s*(\d+)(?:\.(\d*))?\s*$/.exec(String(text ?? ''));
  if (!match) {
    throw new InvalidAmountError(
      'Enter the amount in plain digits, for example 16500.00 — no currency symbol, no ' +
        'thousands separators and no minus sign.',
    );
  }
  const [, whole, fraction = ''] = match;
  const scaled = `${fraction}${'0'.repeat(exponent)}`.slice(0, exponent);
  // BigInt normalises the leading zeros that `whole` may carry ("007" -> 7n). The server
  // rejects a non-canonical spelling outright, so normalising here is not cosmetic.
  return BigInt(`${whole}${scaled}`).toString();
}

/** Compare two minor-unit strings. -1 / 0 / 1, exact at any magnitude. */
export function compareMinor(a: string, b: string): number {
  const left = BigInt(a);
  const right = BigInt(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Display form: `KES 16,500.00`. Grouping is applied to the WHOLE part only, as a string
 * operation — the value is never turned into a Number, so a figure beyond 2^53 still renders
 * every digit correctly.
 */
export function formatMoneyMinor(
  amountMinor: string | null | undefined,
  currency: string | null | undefined,
  exponent: number | null | undefined,
): string {
  if (amountMinor === null || amountMinor === undefined) return '—';
  let plain: string;
  try {
    plain = formatMinor(amountMinor, exponent as number);
  } catch {
    // Unknown scale: show the raw minor units rather than a wrong figure, and say so.
    return `${currency ?? ''} ${amountMinor} (minor units)`.trim();
  }
  const negative = plain.startsWith('-');
  const unsigned = negative ? plain.slice(1) : plain;
  const [whole, fraction] = unsigned.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = fraction ? `${grouped}.${fraction}` : grouped;
  return `${currency ? `${currency} ` : ''}${negative ? '-' : ''}${body}`;
}

/** Basis points -> a percentage string, exact for the integer bp values the API sends. */
export function formatBasisPoints(bp: number | null | undefined): string {
  if (bp === null || bp === undefined || !Number.isFinite(bp)) return '—';
  return `${(bp / 100).toFixed(2).replace(/\.00$/, '')}%`;
}
