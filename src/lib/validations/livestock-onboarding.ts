import { z } from 'zod';
import {
  isValidPhoneForAnyMarket,
  isValidPhoneForMarket,
  level1Label,
  level2Label,
  phoneHint,
  type Market,
} from '@/lib/market';

// ── Livestock Types ──────────────────────────────────────

export const LIVESTOCK_TYPES = [
  { value: 'CATTLE', label: 'Cattle', tluFactor: 1.0 },
  { value: 'GOAT', label: 'Goat', tluFactor: 0.1 },
  { value: 'SHEEP', label: 'Sheep', tluFactor: 0.1 },
  { value: 'CAMEL', label: 'Camel', tluFactor: 1.4 },
  { value: 'POULTRY', label: 'Poultry', tluFactor: 0.01 },
] as const;

export type LivestockTypeValue = typeof LIVESTOCK_TYPES[number]['value'];

/** Calculate Tropical Livestock Units from head count */
export function calculateTLU(livestockType: LivestockTypeValue, headCount: number): number {
  const entry = LIVESTOCK_TYPES.find((lt) => lt.value === livestockType);
  if (!entry) return 0;
  return Math.round(headCount * entry.tluFactor * 100) / 100;
}

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
    nationalId: z.string()
      .min(5, 'ID must be at least 5 characters')
      .max(30, 'ID must not exceed 30 characters'),
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
export const pastoralistRegistrationSchema = pastoralistRegistrationSchemaFor(null);

export type PastoralistRegistrationData = z.infer<typeof pastoralistRegistrationSchema>;

/** Herd registration — links to an insurance unit for county-level coverage */
export const herdRegistrationSchema = z.object({
  name: z.string()
    .min(2, 'Herd name must be at least 2 characters')
    .max(100, 'Herd name must not exceed 100 characters'),
  livestockType: z.enum(['CATTLE', 'GOAT', 'SHEEP', 'CAMEL', 'POULTRY']),
  headCount: z.number()
    .int('Head count must be a whole number')
    .min(1, 'Must have at least 1 animal')
    .max(100000, 'Head count must not exceed 100,000'),
  estimatedValue: z.number()
    .min(100, 'Estimated value per head must be at least 100')
    .max(10000000, 'Estimated value must not exceed 10,000,000'),
  insuranceUnitId: z.string().min(1, 'Insurance unit is required'),
});

export type HerdRegistrationData = z.infer<typeof herdRegistrationSchema>;

/** Livestock policy configuration — season-based IBLI coverage */
export const livestockPolicyConfigSchema = z.object({
  season: z.enum(['LRLD', 'SRSD']),
  coverageType: z.enum(['DROUGHT', 'COMPREHENSIVE']).default('DROUGHT'),
});

export type LivestockPolicyConfigData = z.infer<typeof livestockPolicyConfigSchema>;
