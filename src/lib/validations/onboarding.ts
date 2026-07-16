import { z } from 'zod';
import { isValidPhone, dialCodeFor, type MarketInput } from '@/lib/market';

export const CROP_TYPES = [
  { value: 'MAIZE', label: 'Maize' },
  { value: 'BEANS', label: 'Beans' },
  { value: 'RICE', label: 'Rice' },
  { value: 'SORGHUM', label: 'Sorghum' },
  { value: 'MILLET', label: 'Millet' },
  { value: 'VEGETABLES', label: 'Vegetables' },
  { value: 'CASSAVA', label: 'Cassava' },
  { value: 'SWEET_POTATO', label: 'Sweet Potato' },
  { value: 'BANANA', label: 'Banana' },
  { value: 'COFFEE', label: 'Coffee' },
  { value: 'TEA', label: 'Tea' },
  { value: 'WHEAT', label: 'Wheat' },
  { value: 'BARLEY', label: 'Barley' },
  { value: 'POTATOES', label: 'Potatoes' },
] as const;

/**
 * Farmer registration schema factory. Phone validation is market-aware so a
 * Kenyan org validates +254 exactly as before while a Ghanaian org validates
 * +233. Pass the resolved market (or its dial code / org) to localize.
 */
export function createFarmerRegistrationSchema(market?: MarketInput) {
  return z.object({
    phoneNumber: z.string()
      .refine((v) => isValidPhone(v, market),
        `Enter a valid phone number with country code (e.g. ${dialCodeFor(market)}712345678)`),
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
    county: z.string().min(2, 'County is required'),
    subCounty: z.string().min(2, 'Sub-county is required'),
    ward: z.string().optional(),
    village: z.string().optional(),
  });
}

/** Default (Kenya) instance — preserves prior behavior for callers without a market. */
export const farmerRegistrationSchema = createFarmerRegistrationSchema();

export type FarmerRegistrationData = z.infer<typeof farmerRegistrationSchema>;

export const plotCreationSchema = z.object({
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
  cropType: z.enum([
    'MAIZE', 'BEANS', 'RICE', 'SORGHUM', 'MILLET', 'VEGETABLES',
    'CASSAVA', 'SWEET_POTATO', 'BANANA', 'COFFEE', 'TEA', 'WHEAT',
    'BARLEY', 'POTATOES',
  ]),
  plantingDate: z.string().optional(),
});

export type PlotCreationData = z.infer<typeof plotCreationSchema>;

export const policyConfigSchema = z.object({
  sumInsured: z.number()
    .min(1000, 'Minimum sum insured is 1,000 USDC')
    .max(1000000, 'Maximum sum insured is 1,000,000 USDC'),
  coverageType: z.enum(['DROUGHT', 'FLOOD', 'BOTH', 'COMPREHENSIVE']),
  durationDays: z.number()
    .min(30, 'Minimum duration is 30 days')
    .max(365, 'Maximum duration is 365 days'),
});

export type PolicyConfigData = z.infer<typeof policyConfigSchema>;
