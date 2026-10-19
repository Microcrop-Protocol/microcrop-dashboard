/**
 * HIDDEN MARKETS AT THE FORM BOUNDARY.
 *
 * Uganda, Tanzania, Zambia, Nigeria and Rwanda are configured but hidden (`signupOpen: false`):
 *
 *   1. SELF-SIGNUP REFUSES THEM, mirroring the backend's registerOrganizationSchema, which takes
 *      only signup-open codes. A client schema that accepted one would let the form submit into
 *      a server refusal.
 *   2. THE PLATFORM-ADMIN CREATE PATH ACCEPTS THEM, mirroring the backend's registerOrgSchema:
 *      ops may deliberately onboard a design partner into a hidden market.
 *   3. THE SUM-INSURED HINT WITH NO MARKET IN HAND IS UNCHANGED: an organization whose country
 *      the dashboard cannot resolve is priced as the default market, never as a hidden one.
 */
import { describe, it, expect } from 'vitest';
import { adminCreateOrganizationSchema, orgSignupSchemaFor } from '@/lib/validations/kyb';
import { policyConfigSchemaFor } from '@/lib/validations/onboarding';
import { MARKETS } from '@/lib/market';

const SIGNUP = {
  organizationName: 'Acme Cooperative',
  firstName: 'Amina',
  lastName: 'Otieno',
  email: 'amina@example.com',
  password: 'Sup3rSecret!',
  confirmPassword: 'Sup3rSecret!',
  phone: '',
};

const HIDDEN = ['UG', 'TZ', 'ZM', 'NG', 'RW'] as const;

describe('self-signup takes open markets only', () => {
  it.each(['KE', 'GH'] as const)('accepts %s', (countryCode) => {
    expect(orgSignupSchemaFor(countryCode).safeParse({ ...SIGNUP, countryCode }).success).toBe(true);
  });

  it.each(HIDDEN)('refuses the hidden market %s on the countryCode field', (countryCode) => {
    const result = orgSignupSchemaFor(countryCode).safeParse({ ...SIGNUP, countryCode });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('countryCode');
  });
});

describe('platform-admin create takes every market', () => {
  const countryCode = adminCreateOrganizationSchema.shape.countryCode;

  it.each(['KE', 'GH', ...HIDDEN])('accepts %s', (code) => {
    expect(countryCode.safeParse(code).success).toBe(true);
  });

  it('still refuses a code this build does not know', () => {
    expect(countryCode.safeParse('ZZ').success).toBe(false);
  });
});

describe('sum-insured bounds', () => {
  const CONFIG = { coverageType: 'DROUGHT' as const, durationDays: 90 };
  const message = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

  it("uses a hidden market's own bounds, in its own currency, when the market is known", () => {
    const ug = policyConfigSchemaFor(MARKETS.UG);
    expect(ug.safeParse({ ...CONFIG, sumInsured: 30000000 }).success).toBe(true);
    expect(message(ug.safeParse({ ...CONFIG, sumInsured: 20000 }))).toBe('Minimum sum insured is UGX 30,000');
  });

  it('keeps the no-market bounds at the open markets’ range', () => {
    const any = policyConfigSchemaFor(null);
    expect(message(any.safeParse({ ...CONFIG, sumInsured: 500 }))).toBe('Minimum sum insured is 1,000');
    expect(any.safeParse({ ...CONFIG, sumInsured: 2000000 }).success).toBe(false);
  });
});
