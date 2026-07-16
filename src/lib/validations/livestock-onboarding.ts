import { z } from 'zod';
import { isValidPhone, dialCodeFor, type MarketInput } from '@/lib/market';

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
 * Phone validation is market-aware (accepts +254, +233, … via the foundation's
 * phone helpers). Pass the resolved market/dial code to localize.
 */
export function createPastoralistRegistrationSchema(market?: MarketInput) {
  return z.object({
    phoneNumber: z.string()
      .refine((v) => isValidPhone(v, market),
        `Enter a valid phone number with country code (e.g. ${dialCodeFor(market)}712345678)`),
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
    county: z.string().min(2, 'County is required'),
    subCounty: z.string().min(2, 'Sub-county is required'),
    ward: z.string().optional(),
    village: z.string().optional(),
  });
}

/** Default (Kenya) instance — preserves prior behavior for callers without a market. */
export const pastoralistRegistrationSchema = createPastoralistRegistrationSchema();

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
