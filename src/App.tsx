import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Auth pages
import LoginPage from "@/pages/auth/LoginPage";

// Platform pages
import PlatformDashboard from "@/pages/platform/PlatformDashboard";
import OrganizationsPage from "@/pages/platform/OrganizationsPage";
import OrganizationDetailPage from "@/pages/platform/OrganizationDetailPage";
import RevenueAnalyticsPage from "@/pages/platform/analytics/RevenueAnalyticsPage";
import PoliciesAnalyticsPage from "@/pages/platform/analytics/PoliciesAnalyticsPage";
import FarmersAnalyticsPage from "@/pages/platform/analytics/FarmersAnalyticsPage";
import PayoutsAnalyticsPage from "@/pages/platform/analytics/PayoutsAnalyticsPage";
import DamageAnalyticsPage from "@/pages/platform/analytics/DamageAnalyticsPage";
import PlatformActivityPage from "@/pages/platform/PlatformActivityPage";

// Org pages
import OrgDashboard from "@/pages/org/OrgDashboard";
import FarmersPage from "@/pages/org/FarmersPage";
import FarmerDetailPage from "@/pages/org/FarmerDetailPage";
import FarmerImportPage from "@/pages/org/FarmerImportPage";
import PoliciesPage from "@/pages/org/PoliciesPage";
import PolicyDetailPage from "@/pages/org/PolicyDetailPage";
import NewPolicyPage from "@/pages/org/NewPolicyPage";
import PayoutsPage from "@/pages/org/PayoutsPage";
import PlotsPage from "@/pages/org/PlotsPage";
import DamagePage from "@/pages/org/DamagePage";
import FinancialsPage from "@/pages/org/FinancialsPage";
import PoolPage from "@/pages/org/PoolPage";
import StaffPage from "@/pages/org/StaffPage";
import ExportPage from "@/pages/org/ExportPage";
import OrgActivityPage from "@/pages/org/OrgActivityPage";

import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (user?.role === 'PLATFORM_ADMIN') {
    return <Navigate to="/platform/dashboard" replace />;
  }
  
  return <Navigate to="/org/dashboard" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* Auth routes */}
          <Route path="/login" element={<LoginPage />} />

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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
