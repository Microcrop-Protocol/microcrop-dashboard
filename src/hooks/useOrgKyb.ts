import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { KYBStatus } from "@/types";

/**
 * Reads the current org's KYB status (GET /organizations/me/kyb).
 *
 * Shares the ['my-kyb'] query cache with the Verification (KYB) page. Only
 * meaningful for org users — platform admins have no org KYB, so the query is
 * disabled for them and `isVerified` defaults to true (nothing to gate).
 */
export function useOrgKyb() {
  const { isPlatformAdmin } = useAuthStore();
  const enabled = !isPlatformAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ["my-kyb"],
    queryFn: () => api.getMyKyb(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const kybStatus: KYBStatus | undefined = data?.kybStatus;
  // If we can't determine status (platform admin, or still loading), don't gate.
  const isVerified = !enabled || kybStatus === "VERIFIED";

  return { kybStatus, isVerified, isLoading: enabled && isLoading };
}
