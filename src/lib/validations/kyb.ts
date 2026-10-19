import { z } from 'zod';
import {
  DEFAULT_COUNTRY_CODE,
  SIGNUP_COUNTRY_CODES,
  SUPPORTED_COUNTRY_CODES,
  isValidPhoneForAnyMarket,
  isValidPhoneForMarket,
  marketOrNull,
  phoneHint,
  type CountryCode,
} from '@/lib/market';

/**
 * PHONE VALIDATION IS MARKET-DRIVEN, not Kenya-only.
 *
 * This file used to carry `/^(\+254|0)[17]\d{8}$/` and the message "Please enter a valid Kenyan
 * phone number". The backend's signup and farmer validators were Kenya-only in exactly the same
 * way and are now driven by `markets.js` (`validators/market-phone.js`), so a Ghanaian partner's
 * +233 number is accepted server-side — and was still rejected here, by the dashboard, before it
 * ever reached the API.
 *
 * TWO VALIDATORS, BECAUSE THERE ARE TWO SITUATIONS, and collapsing them gets one of them wrong:
 *
 *   `marketPhone(countryCode)`  the form KNOWS the market (signup, where the country is a field
 *                               on the same form). Accepts only that market's numbers, matching
 *                               the backend's service-layer `assertPhoneForMarket` — a Kenyan
 *                               organization storing a +233 number is a defect the schema should
 *                               catch, not pass on.
 *   `anyMarketPhone()`          the form does NOT know the market (editing a profile, where the
 *                               organization's countryCode is not in the payload). Accepts any
 *                               supported market; the backend re-checks it against the caller's
 *                               own market, which is the half this cannot do.
 */
const marketPhone = (countryCode: CountryCode | string | undefined) => {
  const market = marketOrNull(countryCode);
  return z.string().refine((value) => isValidPhoneForMarket(value, market), {
    message: phoneHint(market),
  });
};

const anyMarketPhone = () =>
  z.string().refine(isValidPhoneForAnyMarket, { message: phoneHint(null) });

export const organizationRegistrationSchema = z.object({
  // Organization details
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be less than 100 characters'),
  registrationNumber: z
    .string()
    .min(1, 'Registration number is required')
    .max(50, 'Registration number must be less than 50 characters'),
  type: z.enum(['COOPERATIVE', 'NGO', 'MFI', 'INSURANCE_COMPANY', 'GOVERNMENT', 'OTHER'], {
    required_error: 'Please select an organization type',
  }),

  // Contact person details
  contactFirstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters'),
  contactLastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters'),
  contactEmail: z
    .string()
    .email('Please enter a valid email address'),
  // No market in hand on this form, so any supported market's number is accepted and the
  // backend narrows it to the organization's own.
  contactPhone: anyMarketPhone(),
});

export type OrganizationRegistrationFormData = z.infer<typeof organizationRegistrationSchema>;

/**
 * SELF-SERVICE ORG SIGNUP — the minimal set, mirroring registerOrganizationSchema server-side.
 *
 * SIX FIELDS: email, password, firstName, lastName, organizationName, countryCode. No KYB datum
 * is asked for, which is the point.
 *
 * `registrationNumber` and `type` WERE required here. Both are KYB data — the registration number
 * is literally the input to AML screening, and `type` is the entity classification a reviewer
 * wants next to the registration certificate. Requiring them at signup bought no assurance (a
 * single character satisfied `min(1)`) while costing two mandatory fields on the first screen
 * and, because the column is UNIQUE, a hard 409 on a typo'd or squatted number with no
 * self-service remedy. They are collected in Settings -> Verification now, where the certificate
 * that proves them is uploaded, and `submitOrgKyb` refuses a submission while the registration
 * number is still null — so nothing is lost by deferring them.
 *
 * `countryCode` IS asked, and it is REQUIRED with no default even though the backend defaults to
 * KE. That asymmetry is deliberate: the backend's default exists for backward compatibility with
 * callers that cannot send it, and relying on it is exactly how every self-signup organization
 * silently became Kenyan — Ghanaian partners got KES pricing, Kenyan premium bounds and the
 * Kenya/IRA KYB checklist with no way to correct it. A defaulted picker would reproduce that
 * with a visible control, which is worse: it would look like the partner chose Kenya.
 *
 * The phone is validated against the CHOSEN market, which is why this is a function of the form
 * value rather than a static schema (see `orgSignupSchemaFor`).
 */
const orgSignupBase = {
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  // OPEN markets only (`signupOpen`), as the backend's registerOrganizationSchema: a hidden
  // market is refused at self-signup. The admin create schema below keeps every market.
  countryCode: z.enum(SIGNUP_COUNTRY_CODES as unknown as [CountryCode, ...CountryCode[]], {
    required_error: 'Please select the country your organization operates in',
  }),
  county: z.string().max(100).optional(),
  // min(1), matching the backend: one-character given names exist, and signup was stricter than
  // editing the same field.
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
      'Include an uppercase letter, a number, and a special character'
    ),
  confirmPassword: z.string(),
};

const passwordsMatch = (d: { password: string; confirmPassword: string }) =>
  d.password === d.confirmPassword;
const passwordsMatchError = { message: 'Passwords do not match', path: ['confirmPassword'] };

/**
 * The signup schema for a KNOWN country, so the optional phone is checked against that market's
 * format rather than against "any market" — which would let a Kenyan organization store a
 * Ghanaian number, the exact mismatch the backend's service layer refuses.
 *
 * Called with the live `countryCode` form value. Before a country is picked it falls back to the
 * default market's format purely so the field has SOME message to show; the country field is
 * required, so a submit cannot get past that point with no market chosen.
 */
export const orgSignupSchemaFor = (countryCode: CountryCode | string | undefined) =>
  z
    .object({
      ...orgSignupBase,
      phone: marketPhone(countryCode ?? DEFAULT_COUNTRY_CODE)
        .optional()
        .or(z.literal('')),
    })
    .refine(passwordsMatch, passwordsMatchError);

/** Market-agnostic variant, for a caller with no country in hand. */
export const orgSignupSchema = z
  .object({ ...orgSignupBase, phone: anyMarketPhone().optional().or(z.literal('')) })
  .refine(passwordsMatch, passwordsMatchError);

export type OrgSignupFormData = z.infer<typeof orgSignupSchema>;

export const orgTypeLabels: Record<string, string> = {
  COOPERATIVE: 'Cooperative',
  NGO: 'NGO',
  MFI: 'Microfinance Institution',
  INSURANCE_COMPANY: 'Insurance Company',
  GOVERNMENT: 'Government',
  OTHER: 'Other',
};

// KYB verification schema (for admin review)
export const kybVerificationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'], {
    required_error: 'Please select a verification status',
  }),
  reviewNotes: z
    .string()
    .max(500, 'Review notes must be less than 500 characters')
    .optional(),
});

export type KYBVerificationFormData = z.infer<typeof kybVerificationSchema>;

// Admin create organization schema
export const adminCreateOrganizationSchema = organizationRegistrationSchema.extend({
  verifyImmediately: z.boolean().default(false),
  /**
   * REQUIRED, with no default. A platform admin creating an organization is deciding its
   * currency, its premium bounds, its payment provider and its KYB document set.
   *
   * It was absent from this form AND from the backend's `registerOrgSchema`, which runs with
   * stripUnknown — so even a dashboard that sent it would have had the field silently deleted
   * and the organization would have landed on the Kenya column default. There was no way to
   * create a Ghanaian organization at all.
   */
  countryCode: z.enum(SUPPORTED_COUNTRY_CODES as unknown as [CountryCode, ...CountryCode[]], {
    required_error: 'Select the country this organization operates in',
  }),
  // Optional fields for admin creation
  brandName: z.string().optional(),
  county: z.string().optional(),
});

export type AdminCreateOrganizationFormData = z.infer<typeof adminCreateOrganizationSchema>;

// Accept invitation schema
export const acceptInvitationSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type AcceptInvitationFormData = z.infer<typeof acceptInvitationSchema>;

/**
 * LAST-RESORT document labels.
 *
 * The per-market checklist from `GET /organizations/me/kyb` carries the authoritative label for
 * every document, resolved from the organization's own market — "Tax certificate (KRA PIN)" is a
 * Kenya Revenue Authority term and is meaningless in Ghana, which is exactly why the label lives
 * next to the market that uses it rather than in a flat table here.
 *
 * This map is reached only when a response carries no checklist at all. Its entries are
 * deliberately MARKET-NEUTRAL for that reason: a fallback that guesses a Kenyan term would put a
 * Kenyan term in front of a Ghanaian partner, which is the bug this slice exists to remove.
 */
export const documentTypeLabels: Record<string, string> = {
  BUSINESS_REGISTRATION: 'Business Registration Certificate',
  TAX_CERTIFICATE: 'Tax Certificate',
  DIRECTOR_ID: 'Director ID',
  PROOF_OF_ADDRESS: 'Proof of Address',
  BANK_STATEMENT: 'Bank Statement',
  IRA_LICENSE: 'IRA Operating License (Insurance Regulatory Authority)',
  CERTIFICATE_OF_INCORPORATION: 'Certificate of Incorporation',
  NIC_LICENSE: 'NIC Operating License (National Insurance Commission)',
  GHANA_TIN: 'Ghana TIN',
  OTHER: 'Other Document',
};

// Organization type labels
export const organizationTypeLabels: Record<string, string> = {
  COOPERATIVE: 'Cooperative',
  NGO: 'NGO',
  MFI: 'Microfinance Institution',
  INSURANCE_COMPANY: 'Insurance Company',
  GOVERNMENT: 'Government',
  OTHER: 'Other',
};
