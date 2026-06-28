import { z } from 'zod';

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
