import { z } from 'zod';
import {
  isValidPhoneForAnyMarket,
  isValidPhoneForMarket,
  level1Label,
  level2Label,
  phoneHint,
  type Market,
} from '@/lib/market';
import { isSellable } from '@/lib/catalogue';
import type { CatalogueItem } from '@/types/catalogue';
import { headCountField, nationalIdField, personNameField } from './onboarding-fields';

// ── Schemas ──────────────────────────────────────────────

/**
 * Pastoralist registration — same as farmer but labelled differently.
 * Phone accepts multiple African country codes for scalability.
 */

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
export const pastoralistRegistrationSchemaFor = (market: Market | null) =>
  z.object({
    phoneNumber: z
      .string()
      .refine(
        (value) => (market ? isValidPhoneForMarket(value, market) : isValidPhoneForAnyMarket(value)),
        { message: phoneHint(market) },
      ),
    // 6–20, the server's rule (was 5–30 here: a 5- or 21-character ID passed the form and was
    // refused by registerFarmerSchema).
    nationalId: nationalIdField,
    firstName: personNameField('First name')
      .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes allowed'),
    lastName: personNameField('Last name')
      .regex(/^[a-zA-Z\s'-]+$/, 'Only letters, spaces, hyphens, and apostrophes allowed'),
    county: z.string().min(2, `${level1Label(market)} is required`),
    subCounty: z.string().min(2, `${level2Label(market)} is required`),
    ward: z.string().optional(),
    village: z.string().optional(),
  });

/** Market-agnostic variant, for the type and for any caller with no market in hand. */
export const pastoralistRegistrationSchema = pastoralistRegistrationSchemaFor(null);

export type PastoralistRegistrationData = z.infer<typeof pastoralistRegistrationSchema>;

/**
 * Herd registration — links to an insurance unit for unit-level (IBLI) coverage.
 *
 * MARKET-DRIVEN livestock choice, for the same reason as plotCreationSchemaFor: `livestockType`
 * was an enum over every species including poultry, which no market lists. It now accepts exactly
 * what the picker offers — a SELLABLE item of the market's LIVESTOCK line — and nothing while the
 * catalogue is not known. The TLU factor comes from the same catalogue item (lib/catalogue
 * `tluFor`); the five-entry table that used to live here was a second copy of it.
 */
export const herdRegistrationSchemaFor = (livestock: readonly CatalogueItem[] | null) =>
  z.object({
    name: z.string()
      .min(2, 'Herd name must be at least 2 characters')
      .max(100, 'Herd name must not exceed 100 characters'),
    livestockType: z.string({ required_error: 'Select a livestock type' })
      .min(1, 'Select a livestock type')
      .refine(
        (code) => Boolean(livestock?.some((item) => item.code === code && isSellable(item))),
        {
          message: livestock
            ? "Choose a livestock type offered in your organization's market."
            : "Your market's livestock list hasn't loaded yet.",
        },
      ),
    headCount: headCountField,
    estimatedValue: z.number()
      .min(100, 'Estimated value per head must be at least 100')
      .max(10000000, 'Estimated value must not exceed 10,000,000'),
    insuranceUnitId: z.string().min(1, 'Insurance unit is required'),
  });

/** Catalogue-agnostic variant, for the type. */
export const herdRegistrationSchema = herdRegistrationSchemaFor(null);

export type HerdRegistrationData = z.infer<typeof herdRegistrationSchema>;

/** Livestock policy configuration — season-based IBLI coverage */
export const livestockPolicyConfigSchema = z.object({
  season: z.enum(['LRLD', 'SRSD']),
  coverageType: z.enum(['DROUGHT', 'COMPREHENSIVE']).default('DROUGHT'),
});

export type LivestockPolicyConfigData = z.infer<typeof livestockPolicyConfigSchema>;
