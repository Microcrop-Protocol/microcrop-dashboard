import { z } from 'zod';

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

export const farmerRegistrationSchema = z.object({
  phoneNumber: z.string()
    .regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan phone number (+254...)'),
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
