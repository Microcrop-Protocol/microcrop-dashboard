import { z } from 'zod';

// Ethereum address validation regex
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;

// Pool deposit schema - minimum 100 USDC
export const poolDepositSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required' })
    .min(100, 'Minimum deposit is 100 USDC')
    .max(1000000, 'Maximum deposit is 1,000,000 USDC'),
  minTokensOut: z.number().optional(),
});

export type PoolDepositFormData = z.infer<typeof poolDepositSchema>;

// Pool withdraw schema
export const poolWithdrawSchema = z.object({
  tokenAmount: z
    .number({ required_error: 'Token amount is required' })
    .min(1, 'Minimum withdrawal is 1 token')
    .positive('Amount must be positive'),
  minUsdcOut: z.number().optional(),
});

export type PoolWithdrawFormData = z.infer<typeof poolWithdrawSchema>;

// Add depositor schema - Ethereum address validation
export const addDepositorSchema = z.object({
  depositorAddress: z
    .string()
    .min(1, 'Address is required')
    .regex(ethereumAddressRegex, 'Please enter a valid Ethereum address'),
});

export type AddDepositorFormData = z.infer<typeof addDepositorSchema>;

// Pool settings schema
export const poolSettingsSchema = z.object({
  depositsOpen: z.boolean(),
  withdrawalsOpen: z.boolean(),
});

export type PoolSettingsFormData = z.infer<typeof poolSettingsSchema>;

// Deploy pool schema
export const deployPoolSchema = z.object({
  name: z
    .string()
    .min(3, 'Pool name must be at least 3 characters')
    .max(50, 'Pool name must be less than 50 characters'),
  symbol: z
    .string()
    .min(2, 'Symbol must be at least 2 characters')
    .max(10, 'Symbol must be less than 10 characters')
    .regex(/^[A-Z]+$/, 'Symbol must be uppercase letters only'),
  poolType: z.enum(['PUBLIC', 'PRIVATE', 'MUTUAL'], {
    required_error: 'Please select a pool type',
  }),
  coverageType: z.enum(['DROUGHT', 'FLOOD', 'PEST', 'DISEASE', 'COMPREHENSIVE'], {
    required_error: 'Please select a coverage type',
  }),
  region: z
    .string()
    .min(2, 'Region must be at least 2 characters')
    .max(50, 'Region must be less than 50 characters'),
  minDeposit: z
    .number({ required_error: 'Minimum deposit is required' })
    .min(1, 'Minimum deposit must be at least 1'),
  maxDeposit: z
    .number({ required_error: 'Maximum deposit is required' })
    .min(100, 'Maximum deposit must be at least 100'),
  targetCapital: z
    .number({ required_error: 'Target capital is required' })
    .min(1000, 'Target capital must be at least 1,000'),
  maxCapital: z
    .number({ required_error: 'Maximum capital is required' })
    .min(1000, 'Maximum capital must be at least 1,000'),
  poolOwner: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address')
    .optional(),
}).refine((data) => data.maxDeposit >= data.minDeposit, {
  message: 'Maximum deposit must be greater than minimum deposit',
  path: ['maxDeposit'],
}).refine((data) => data.maxCapital >= data.targetCapital, {
  message: 'Maximum capital must be greater than target capital',
  path: ['maxCapital'],
});

export type DeployPoolFormData = z.infer<typeof deployPoolSchema>;

// Fund wallet via M-Pesa schema
export const fundWalletSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, 'Phone number is required')
    .regex(/^0[17]\d{8}$/, 'Enter a valid Safaricom number (e.g. 0712345678)'),
  amountKES: z
    .number({ required_error: 'Amount is required' })
    .min(10, 'Minimum amount is 10 KES')
    .max(150000, 'Maximum amount is 150,000 KES'),
});

export type FundWalletFormData = z.infer<typeof fundWalletSchema>;

// Pool type labels
export const poolTypeLabels: Record<string, string> = {
  PUBLIC: 'Public Pool',
  PRIVATE: 'Private Pool',
  MUTUAL: 'Mutual Pool',
};

// Coverage type labels
export const coverageTypeLabels: Record<string, string> = {
  DROUGHT: 'Drought',
  FLOOD: 'Flood',
  PEST: 'Pest',
  DISEASE: 'Disease',
  COMPREHENSIVE: 'Comprehensive',
};
