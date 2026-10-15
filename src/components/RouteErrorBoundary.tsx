import { Suspense } from "react";
import { useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";

/**
 * Error and loading boundary for routed content. Must sit inside the router.
 *
 * Resets on navigation (resetKey = pathname), so a page that threw is cleared by clicking any
 * link, instead of the error screen staying up until a full reload. Placed around the page
 * outlet in DashboardLayout, it also keeps the sidebar and header mounted while a page loads or
 * fails. The top-level ErrorBoundary in App stays as the last resort.
 */
export function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname} scope="route">
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
