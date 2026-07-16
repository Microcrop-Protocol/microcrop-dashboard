import { z } from 'zod';
import { isValidPhone, dialCodeFor, toMarket, type MarketInput } from '@/lib/market';

/**
 * Fund-wallet (mobile-money top-up) schema factory. Phone validation and the
 * currency-bound messages are market-aware: a Kenyan org validates M-Pesa /
 * KES exactly as before, a Ghanaian org validates MTN MoMo / GHS. The
 * `amountKES` field name is retained for backward compatibility with existing
 * callers even though the amount is now expressed in the org's currency.
 */
export function createFundWalletSchema(market?: MarketInput) {
  const m = toMarket(market);
  return z.object({
    phoneNumber: z
      .string()
      .min(10, 'Phone number is required')
      .refine((v) => isValidPhone(v, m),
        `Enter a valid ${m.mobileMoney} number (e.g. ${dialCodeFor(m)}712345678)`),
    amountKES: z
      .number({ required_error: 'Amount is required' })
      .min(10, `Minimum amount is 10 ${m.currency}`)
      .max(150000, `Maximum amount is 150,000 ${m.currency}`),
  });
}

/** Default (Kenya) instance — preserves prior behavior for callers without a market. */
export const fundWalletSchema = createFundWalletSchema();

export type FundWalletFormData = z.infer<typeof fundWalletSchema>;
