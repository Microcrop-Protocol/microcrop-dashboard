/**
 * FIELD ONBOARDING — register a farmer, walk the plot, quote and sell crop cover.
 *
 * CROP_UNDERWRITING is gated here, at the page, rather than at the purchase step inside the
 * wizard. The wizard's last two steps call `policy.service` quote and purchase, both of which
 * assert the capability — so without it a field agent would register a farmer, walk a boundary
 * on a phone in a field, run the KYC check, and only then be refused. The work before the
 * refusal is the expensive part, and it is not recoverable by retrying.
 *
 * The route already requires the `farmer:create` / `plot:create` PERMISSIONS, which answer a
 * different question (may this user) and carry different copy (ask your administrator).
 */
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { CapabilityGate } from '@/components/capability/CapabilityGate';
import { useCapability } from '@/hooks/useCapabilities';
import { CAPABILITY } from '@/lib/capability';

export default function FieldOnboardingPage() {
  const cropUnderwriting = useCapability(CAPABILITY.CROP_UNDERWRITING);

  return (
    <CapabilityGate
      capability={CAPABILITY.CROP_UNDERWRITING}
      state={cropUnderwriting.state}
      onRetry={cropUnderwriting.refetch}
      className="m-6"
    >
      <OnboardingWizard />
    </CapabilityGate>
  );
}
