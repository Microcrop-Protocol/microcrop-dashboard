import { Suspense, lazy, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getSubdomainContext } from "@/lib/subdomain";

// Retry dynamic imports once on failure (handles stale chunks after deploy)
function lazyRetry(importFn: () => Promise<{ default: ComponentType }>) {
  return lazy(() =>
    importFn().catch(() => {
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
      }
      sessionStorage.removeItem('chunk_reload');
      return importFn();
    })
  );
}

// Auth pages
const LoginPage = lazyRetry(() => import("@/pages/auth/LoginPage"));
const ForgotPasswordPage = lazyRetry(() => import("@/pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazyRetry(() => import("@/pages/auth/ResetPasswordPage"));
const RegisterOrganizationPage = lazyRetry(() => import("@/pages/auth/RegisterOrganizationPage"));
const AcceptInvitationPage = lazyRetry(() => import("@/pages/auth/AcceptInvitationPage"));

// Platform pages
const PlatformDashboard = lazyRetry(() => import("@/pages/platform/PlatformDashboard"));
const OrganizationsPage = lazyRetry(() => import("@/pages/platform/OrganizationsPage"));
const OrganizationDetailPage = lazyRetry(() => import("@/pages/platform/OrganizationDetailPage"));
const RevenueAnalyticsPage = lazyRetry(() => import("@/pages/platform/analytics/RevenueAnalyticsPage"));
const PoliciesAnalyticsPage = lazyRetry(() => import("@/pages/platform/analytics/PoliciesAnalyticsPage"));
const FarmersAnalyticsPage = lazyRetry(() => import("@/pages/platform/analytics/FarmersAnalyticsPage"));
const PayoutsAnalyticsPage = lazyRetry(() => import("@/pages/platform/analytics/PayoutsAnalyticsPage"));
const DamageAnalyticsPage = lazyRetry(() => import("@/pages/platform/analytics/DamageAnalyticsPage"));
const PlatformActivityPage = lazyRetry(() => import("@/pages/platform/PlatformActivityPage"));
const KYBReviewPage = lazyRetry(() => import("@/pages/platform/KYBReviewPage"));
const KYBApplicationDetailPage = lazyRetry(() => import("@/pages/platform/KYBApplicationDetailPage"));
const InvitationsPage = lazyRetry(() => import("@/pages/platform/InvitationsPage"));
const PoolsPage = lazyRetry(() => import("@/pages/platform/PoolsPage"));
const TreasuryPage = lazyRetry(() => import("@/pages/platform/TreasuryPage"));

// Org pages
const OrgDashboard = lazyRetry(() => import("@/pages/org/OrgDashboard"));
const FarmersPage = lazyRetry(() => import("@/pages/org/FarmersPage"));
const FarmerDetailPage = lazyRetry(() => import("@/pages/org/FarmerDetailPage"));
const FarmerImportPage = lazyRetry(() => import("@/pages/org/FarmerImportPage"));
const PoliciesPage = lazyRetry(() => import("@/pages/org/PoliciesPage"));
const PolicyDetailPage = lazyRetry(() => import("@/pages/org/PolicyDetailPage"));
const NewPolicyPage = lazyRetry(() => import("@/pages/org/NewPolicyPage"));
const PayoutsPage = lazyRetry(() => import("@/pages/org/PayoutsPage"));
const PlotsPage = lazyRetry(() => import("@/pages/org/PlotsPage"));
const DamagePage = lazyRetry(() => import("@/pages/org/DamagePage"));
const FinancialsPage = lazyRetry(() => import("@/pages/org/FinancialsPage"));
const PoolPage = lazyRetry(() => import("@/pages/org/PoolPage"));
const StaffPage = lazyRetry(() => import("@/pages/org/StaffPage"));
const ExportPage = lazyRetry(() => import("@/pages/org/ExportPage"));
const OrgActivityPage = lazyRetry(() => import("@/pages/org/OrgActivityPage"));

const NotFound = lazyRetry(() => import("@/pages/NotFound"));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function RootRedirect() {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const context = getSubdomainContext();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // On portal subdomain, always go to platform dashboard
  if (context === 'portal') {
    return <Navigate to="/platform/dashboard" replace />;
  }

  // On network subdomain, always go to org dashboard
  if (context === 'network') {
    return <Navigate to="/org/dashboard" replace />;
  }

  // Unrestricted — route by role
  if (user?.role === 'PLATFORM_ADMIN') {
    return <Navigate to="/platform/dashboard" replace />;
  }

  return <Navigate to="/org/dashboard" replace />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Root redirect */}
              <Route path="/" element={<RootRedirect />} />

              {/* Auth routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Public registration routes — blocked on portal (admin-only) subdomain */}
              <Route
                path="/register-organization"
                element={
                  getSubdomainContext() === 'portal'
                    ? <Navigate to="/login" replace />
                    : <RegisterOrganizationPage />
                }
              />
              <Route path="/accept-invitation/:token" element={<AcceptInvitationPage />} />

              {/* Platform Admin routes */}
              <Route
                path="/platform"
                element={
                  <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<PlatformDashboard />} />
                <Route path="organizations" element={<OrganizationsPage />} />
                <Route path="organizations/:orgId" element={<OrganizationDetailPage />} />
                <Route path="analytics/revenue" element={<RevenueAnalyticsPage />} />
                <Route path="analytics/policies" element={<PoliciesAnalyticsPage />} />
                <Route path="analytics/farmers" element={<FarmersAnalyticsPage />} />
                <Route path="analytics/payouts" element={<PayoutsAnalyticsPage />} />
                <Route path="analytics/damage" element={<DamageAnalyticsPage />} />
                <Route path="activity" element={<PlatformActivityPage />} />
                <Route path="kyb-review" element={<KYBReviewPage />} />
                <Route path="kyb-review/:applicationId" element={<KYBApplicationDetailPage />} />
                <Route path="invitations" element={<InvitationsPage />} />
                <Route path="pools" element={<PoolsPage />} />
                <Route path="treasury" element={<TreasuryPage />} />
              </Route>

              {/* Organization routes */}
              <Route
                path="/org"
                element={
                  <ProtectedRoute allowedRoles={['ORG_ADMIN', 'ORG_STAFF']}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<OrgDashboard />} />
                <Route path="farmers" element={<FarmersPage />} />
                <Route path="farmers/import" element={<FarmerImportPage />} />
                <Route path="farmers/:farmerId" element={<FarmerDetailPage />} />
                <Route path="policies" element={<PoliciesPage />} />
                <Route path="policies/new" element={<NewPolicyPage />} />
                <Route path="policies/:policyId" element={<PolicyDetailPage />} />
                <Route path="payouts" element={<PayoutsPage />} />
                <Route path="plots" element={<PlotsPage />} />
                <Route path="damage" element={<DamagePage />} />
                <Route path="financials" element={<FinancialsPage />} />
                <Route path="pool" element={<PoolPage />} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="export" element={<ExportPage />} />
                <Route path="activity" element={<OrgActivityPage />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
