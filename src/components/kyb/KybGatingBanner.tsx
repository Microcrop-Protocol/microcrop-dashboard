import { Link } from "react-router-dom";
import { ShieldAlert, Clock } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOrgKyb } from "@/hooks/useOrgKyb";

interface KybGatingBannerProps {
  /** The gated capability, e.g. "Creating policies". Used to phrase the message. */
  feature: string;
}

/**
 * Non-blocking banner shown on org pages whose critical writes the backend
 * blocks until the org's KYB is VERIFIED (requireVerifiedOrg). Guides the user
 * to the Verification page instead of letting them hit a raw backend error.
 *
 * Renders nothing once the org is verified (or for platform admins).
 */
export function KybGatingBanner({ feature }: KybGatingBannerProps) {
  const { kybStatus, isVerified, isLoading } = useOrgKyb();

  if (isLoading || isVerified) return null;

  const underReview = kybStatus === "PENDING_REVIEW";
  const Icon = underReview ? Clock : ShieldAlert;

  return (
    <Alert>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>
        {underReview ? "Verification in review" : "Organization not verified"}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-muted-foreground">
          {underReview
            ? `${feature} is available once your organization is approved. Your documents are under review.`
            : `${feature} is available once your organization is verified. Complete verification to unlock it.`}
        </span>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/org/kyb">{underReview ? "View status" : "Complete verification"}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
