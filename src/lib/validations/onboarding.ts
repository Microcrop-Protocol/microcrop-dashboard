import { z } from 'zod';
import {
  isValidPhoneForAnyMarket,
  isValidPhoneForMarket,
  level1Label,
  level2Label,
  phoneHint,
  type Market,
} from '@/lib/market';

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
