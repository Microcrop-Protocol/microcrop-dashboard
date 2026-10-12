import { z } from 'zod';
import {
  formatMoney,
  isValidPhoneForAnyMarket,
  isValidPhoneForMarket,
  level1Label,
  level2Label,
  MARKETS,
  phoneHint,
  SUPPORTED_COUNTRY_CODES,
  type Market,
} from '@/lib/market';
import type { CatalogueItem } from '@/types/catalogue';

/**
 * MARKET-DRIVEN registration fields.
 *
 * The phone rule here was `/^\+\d{1,3}\d{6,12}$/` with the message "e.g. +254712345678" — loose
 * enough to accept a US number and Kenyan enough to tell a Ghanaian field agent the wrong thing.
 * Looseness was the worse half: the backend's `farmer.service.register` now asserts the number
 * belongs to the ORGANIZATION'S market, so a +1 number passed this schema and was refused by the
 * server, which is the shape of validation that teaches an agent not to trust the form.
 *
 * The administrative-division messages were "County is required" / "Sub-county is required".
 * The COLUMNS keep those names in every market; the LABELS do not.
 *
 * Both are therefore functions of the market. The schema is built in the component, where the
 * organization is known — see the two onboarding wizards.
 */
export const farmerRegistrationSchemaFor = (market: Market | null) =>
  z.object({
    phoneNumber: z
      .string()
      // Checked against THIS market, matching the backend's service-layer assertion. A null
      // market (the organization has not resolved yet) accepts any supported market's number
      // rather than blocking the form — the server still narrows it.
      .refine(
        (value) => (market ? isValidPhoneForMarket(value, market) : isValidPhoneForAnyMarket(value)),
        { message: phoneHint(market) },
      ),
    nationalId: z.string()
      .min(6, 'National ID must be at least 6 characters')
      .max(20, 'National ID must not exceed 20 characters'),
    firstName: z.string()
      .min(2, 'First name must be at least 2 characters')
      .max(50, 'First name must not exceed 50 characters')
      .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes allowed'),
    lastName: z.string()
      .min(2, 'Last name must be at least 2 characters')
      .max(50, 'Last name must not exceed 50 characters')
      .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes allowed'),
    county: z.string().min(2, `${level1Label(market)} is required`),
    subCounty: z.string().min(2, `${level2Label(market)} is required`),
    ward: z.string().optional(),
    village: z.string().optional(),
  });

/** Market-agnostic variant, for the type and for any caller with no market in hand. */
export const farmerRegistrationSchema = farmerRegistrationSchemaFor(null);

export type FarmerRegistrationData = z.infer<typeof farmerRegistrationSchema>;

/**
 * MARKET-DRIVEN crop choice.
 *
 * `cropType` was `z.enum([...])` over all fourteen values of the Prisma enum, which made tea,
 * cassava and banana valid plot crops in every market. The server now refuses a crop that is not
 * in the organization's market catalogue (PRODUCT_NOT_IN_MARKET) — and ONLY that: its plot gate
 * is "listed", any status, so a COMING_SOON crop can be registered ahead of launch. The client
 * matches it exactly: any LISTED item of the market's CROP line. Whether the crop can then be
 * QUOTED is a separate question, answered at the quote step (and the picker labels a
 * not-yet-sellable crop "Coming soon — cannot be insured yet").
 *
 * `crops === null` is the not-yet-known case. It accepts nothing, with a message that says why,
 * rather than accepting anything and letting the server refuse it.
 */
export const plotCreationSchemaFor = (crops: readonly CatalogueItem[] | null) =>
  z.object({
    name: z.string()
      .min(2, 'Plot name must be at least 2 characters')
      .max(100, 'Plot name must not exceed 100 characters'),
    latitude: z.number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .refine(v => v !== 0, 'Latitude is required'),
    longitude: z.number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .refine(v => v !== 0, 'Longitude is required'),
    acreage: z.number()
      .min(0.1, 'Acreage must be at least 0.1')
      .max(10000, 'Acreage must not exceed 10,000'),
    cropType: z.string({ required_error: 'Select a crop' })
      .min(1, 'Select a crop')
      .refine(
        // Listed, any status — the backend's plot gate. NOT isSellable: that is the quote gate.
        (code) => Boolean(crops?.some((item) => item.code === code)),
        {
          message: crops
            ? "Choose a crop offered in your organization's market."
            : "Your market's crop list hasn't loaded yet.",
        },
      ),
    plantingDate: z.string().optional(),
  });

/** Catalogue-agnostic variant, for the type. Accepts no crop — see plotCreationSchemaFor. */
export const plotCreationSchema = plotCreationSchemaFor(null);

export type PlotCreationData = z.infer<typeof plotCreationSchema>;

/** The widest bounds any supported market accepts, for a form with no market in hand. */
const ANY_MARKET_MIN = Math.min(...SUPPORTED_COUNTRY_CODES.map((c) => MARKETS[c].minSumInsuredLocal));
const ANY_MARKET_MAX = Math.max(...SUPPORTED_COUNTRY_CODES.map((c) => MARKETS[c].maxSumInsuredLocal));

/**
 * MARKET-DRIVEN sum-insured bounds.
 *
 * The messages here said "Minimum sum insured is 1,000 USDC" — wrong in every market, because
 * the wizard quotes in LOCAL currency (the stablecoin leg is settlement plumbing the field agent
 * never sees), and the 1,000,000 ceiling is Kenya's: Ghana's is 250,000.
 *
 * The bounds are the market registry's, which lib/market.ts is explicit are a HINT — policy.service
 * enforces them inside the purchase transaction and its refusal is the truth. With no market in
 * hand the widest bounds any market accepts are used and no currency is named.
 */
export const policyConfigSchemaFor = (market: Market | null) => {
  const min = market?.minSumInsuredLocal ?? ANY_MARKET_MIN;
  const max = market?.maxSumInsuredLocal ?? ANY_MARKET_MAX;
  return z.object({
    sumInsured: z.number()
      .min(min, `Minimum sum insured is ${formatMoney(min, market)}`)
      .max(max, `Maximum sum insured is ${formatMoney(max, market)}`),
    coverageType: z.enum(['DROUGHT', 'FLOOD', 'BOTH', 'COMPREHENSIVE']),
    durationDays: z.number()
      .min(30, 'Minimum duration is 30 days')
      .max(365, 'Maximum duration is 365 days'),
  });
};

export const policyConfigSchema = policyConfigSchemaFor(null);

export type PolicyConfigData = z.infer<typeof policyConfigSchema>;
