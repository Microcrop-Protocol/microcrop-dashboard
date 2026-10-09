/**
 * LIVESTOCK (IBLI) ONBOARDING.
 *
 * TWO REASONS A PARTNER MAY NOT SELL LIVESTOCK, and they need different copy, so they are two
 * branches rather than one:
 *
 *   THE MARKET DOES NOT OFFER IT. Ghana is crop-only (`markets.js` `livestockEnabled: false`),
 *   and the backend ANDs the capability with that flag — so a Ghanaian organization cannot sell
 *   livestock however the toggle is set. Telling such a partner "contact MicroCrop to enable it"
 *   would be a false promise: there is nothing to enable, because there is no product.
 *
 *   THE CAPABILITY IS OFF. The market offers it and this organization has not been granted it:
 *   separate methodology, KLIP unit data and commercial terms. That one IS a conversation with
 *   MicroCrop, which is what the capability panel says.
 *
 * The market branch is checked FIRST and only on a positively-known market, so neither a loading
 * nor an unrecognised country can produce the "not available in your country" claim.
 */
import { LivestockOnboardingWizard } from '@/components/onboarding/LivestockOnboardingWizard';
import { CapabilityGate } from '@/components/capability/CapabilityGate';
import { useCapability } from '@/hooks/useCapabilities';
import { CAPABILITY } from '@/lib/capability';
import { useOrgMarket } from '@/hooks/useOrgMarket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Ban } from 'lucide-react';

export default function LivestockOnboardingPage() {
  const livestock = useCapability(CAPABILITY.LIVESTOCK_UNDERWRITING);
  const { state: marketState, market } = useOrgMarket();

  // Positively-known market that does not offer livestock. `marketState === 'known'` is what
  // keeps a loading or unrecognised country out of this branch.
  if (marketState === 'known' && market && !market.livestockEnabled) {
    return (
      <div className="py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ban className="h-4 w-4" aria-hidden="true" />
              Livestock cover is not available in {market.countryName}
            </CardTitle>
            <CardDescription>
              MicroCrop offers crop cover only in {market.countryName}. Index-based livestock
              insurance depends on market-specific rangeland data and terms that are not in place
              here, so there is no livestock product to enable — this is not a setting on your
              account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your crop underwriting, farmers and policies are unaffected.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-6">
      <CapabilityGate
        capability={CAPABILITY.LIVESTOCK_UNDERWRITING}
        state={livestock.state}
        onRetry={livestock.refetch}
      >
        <LivestockOnboardingWizard />
      </CapabilityGate>
    </div>
  );
}
