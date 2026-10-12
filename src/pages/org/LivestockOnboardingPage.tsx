/**
 * LIVESTOCK (IBLI) ONBOARDING.
 *
 * TWO REASONS A PARTNER MAY NOT SELL LIVESTOCK, and they need different copy, so they are two
 * branches rather than one:
 *
 *   THE MARKET DOES NOT OFFER IT. Ghana lists no livestock (`markets.js` `livestockEnabled:
 *   false`, and an empty LIVESTOCK line in the product catalogue), and the backend ANDs the
 *   capability with that flag — so a Ghanaian organization cannot sell livestock however the
 *   toggle is set. Telling such a partner "contact MicroCrop to enable it" would be a false
 *   promise: there is nothing to enable, because there is no product.

 *   THE CAPABILITY IS OFF. The market offers it and this organization has not been granted it:
 *   separate methodology, KLIP unit data and commercial terms. That one IS a conversation with
 *   MicroCrop, which is what the capability panel says.
 *
 * The market branch is checked FIRST and only on a positively-known answer (see
 * useLivestockNotOffered), so neither a loading nor an unrecognised country can produce the "not
 * offered in your country" claim.
 */
import { LivestockOnboardingWizard } from '@/components/onboarding/LivestockOnboardingWizard';
import { CapabilityGate } from '@/components/capability/CapabilityGate';
import { useCapability } from '@/hooks/useCapabilities';
import { CAPABILITY } from '@/lib/capability';
import { useLivestockNotOffered } from '@/hooks/useCatalogue';
import { LivestockNotOffered } from '@/components/catalogue/LivestockNotOffered';

export default function LivestockOnboardingPage() {
  const livestock = useCapability(CAPABILITY.LIVESTOCK_UNDERWRITING);
  const notOfferedIn = useLivestockNotOffered();

  if (notOfferedIn) {
    return (
      <div className="py-6">
        <LivestockNotOffered countryName={notOfferedIn} />
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
