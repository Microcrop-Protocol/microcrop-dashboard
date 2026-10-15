/**
 * The wizards and the import preparers share one set of field rules. These pin that the wizard
 * schemas are built from them (so a change to a rule moves both paths), and the one deliberate
 * alignment: the livestock wizard's national ID is the server's 6–20, not 5–30.
 */
import { describe, expect, it } from 'vitest';
import { MARKETS } from '@/lib/market';
import { farmerRegistrationSchemaFor, plotCreationSchemaFor } from '@/lib/validations/onboarding';
import { pastoralistRegistrationSchemaFor } from '@/lib/validations/livestock-onboarding';
import { isNullIsland, nationalIdField, plotNameField } from '@/lib/validations/onboarding-fields';

describe('shared onboarding fields', () => {
  it('give the farmer and pastoralist wizards the same national ID rule', () => {
    for (const schema of [farmerRegistrationSchemaFor(MARKETS.KE), pastoralistRegistrationSchemaFor(MARKETS.KE)]) {
      const nid = schema.shape.nationalId;
      expect(nid).toBe(nationalIdField);
      expect(nid.safeParse('12345').success).toBe(false);
      expect(nid.safeParse('123456').success).toBe(true);
      expect(nid.safeParse('1'.repeat(21)).success).toBe(false);
    }
  });

  it('give the plot wizard the shared plot-name rule', () => {
    expect(plotCreationSchemaFor(null).shape.name).toBe(plotNameField);
  });

  it('treat only the (0,0) pair as no location', () => {
    expect(isNullIsland(0, 0)).toBe(true);
    expect(isNullIsland(5.6, 0)).toBe(false);
    expect(isNullIsland(0, 36.8)).toBe(false);
  });
});
