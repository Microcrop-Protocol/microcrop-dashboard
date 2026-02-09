/**
 * API Client for MicroCrop Backend
 *
 * Base URL configured via environment variable:
 * - Development: VITE_API_URL=http://localhost:3000
 * - Production: VITE_API_URL=https://api.microcrop.app
 */

import type { User, Organization, OnboardingStep, OrganizationStats, PlatformStats, RevenueAnalytics, PoliciesAnalytics, FarmersAnalytics, PayoutsAnalytics, DamageAnalytics, Activity, PoolStatus, LiquidityPool, PoolSettings, Farmer, Plot, Policy, PolicyQuote, PolicyStatus, Payout, FinancialSummary, OrganizationApplication, OrgAdminInvitation } from '@/types';

const API_BASE_URL: string = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private onAuthError: (() => void) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /** Register a callback for 401 responses (called once, then cleared) */
  onUnauthorized(callback: () => void) {
    this.onAuthError = callback;
  }

  private handleAuthError() {
    if (this.onAuthError) {
      this.onAuthError();
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err) {
      throw new ApiError('Network error. Please check your connection.', 0);
    }

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiErrorResponse;
      const message = error.error?.message || 'An error occurred';

      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        this.handleAuthError();
      }

      throw new ApiError(message, response.status, error.error?.code);
    }

    return (data as ApiResponse<T>).data;
  }

  private async requestWithPagination<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; pagination?: ApiResponse<T>['pagination'] }> {
    const url = `${this.baseUrl}/api${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err) {
      throw new ApiError('Network error. Please check your connection.', 0);
    }

    const result = await response.json();

    if (!response.ok) {
      const error = result as ApiErrorResponse;
      const message = error.error?.message || 'An error occurred';

      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        this.handleAuthError();
      }

      throw new ApiError(message, response.status, error.error?.code);
    }

    return {
      data: (result as ApiResponse<T>).data,
      pagination: (result as ApiResponse<T>).pagination,
    };
  }

  // For multipart/form-data requests (file uploads)
  private async uploadRequest<T>(
    endpoint: string,
    formData: FormData
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;

    const headers: HeadersInit = {};

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response: Response;
    try {
      // Don't set Content-Type for FormData - browser will set it with boundary
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (err) {
      throw new ApiError('Network error. Please check your connection.', 0);
    }

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiErrorResponse;
      const message = error.error?.message || 'An error occurred';

      if (response.status === 401) {
        this.handleAuthError();
      }

      throw new ApiError(message, response.status, error.error?.code);
    }

    return (data as ApiResponse<T>).data;
  }

  // ============================================
  // AUTH ENDPOINTS
  // ============================================

  async login(email: string, password: string) {
    const result = await this.request<{
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        organizationId?: string;
      };
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setAccessToken(result.accessToken);
    return result;
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    return this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async refreshToken(refreshToken: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getMe() {
    return this.request<User>('/auth/me');
  }

  async forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // ============================================
  // PLATFORM ADMIN - ORGANIZATIONS
  // ============================================

  async platformRegisterOrganization(data: {
    name: string;
    registrationNumber?: string;
    type: string;
    brandName?: string;
    contactPerson: string;
    contactEmail: string;
    contactPhone: string;
    county?: string;
    adminWallet?: string;
  }) {
    return this.request<{
      organization: Organization;
      apiKey: string;
      apiSecret: string;
    }>('/platform/organizations/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async platformGetOrganizations() {
    return this.request<Organization[]>('/platform/organizations');
  }

  async platformGetOrganization(orgId: string) {
    return this.request<Organization>(`/platform/organizations/${orgId}`);
  }

  async platformConfigureOrganization(orgId: string, config: {
    ussdShortCode?: string;
    brandName?: string;
    brandColor?: string;
    logoUrl?: string;
    webhookUrl?: string;
  }) {
    return this.request<Organization>(`/platform/organizations/${orgId}/configure`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async platformDeployPool(orgId: string, initialCapital: number) {
    return this.request<Organization>(`/platform/organizations/${orgId}/deploy-pool`, {
      method: 'POST',
      body: JSON.stringify({ initialCapital }),
    });
  }

  async platformActivateOrganization(orgId: string) {
    return this.request<Organization>(`/platform/organizations/${orgId}/activate`, {
      method: 'POST',
    });
  }

  async platformDeactivateOrganization(orgId: string) {
    return this.request<Organization>(`/platform/organizations/${orgId}/deactivate`, {
      method: 'POST',
    });
  }

  async platformGetOnboardingStatus(orgId: string) {
    return this.request<{ step: OnboardingStep; completedSteps: OnboardingStep[] }>(`/platform/organizations/${orgId}/onboarding-status`);
  }

  // ============================================
  // PLATFORM DASHBOARD
  // ============================================

  async platformDashboardOverview(params?: { period?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<PlatformStats>(`/dashboard/platform/overview${query ? `?${query}` : ''}`);
  }

  async platformDashboardOrganizations(params?: {
    period?: string;
    page?: number;
    limit?: number;
    type?: string;
    isActive?: boolean;
    search?: string;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<Organization[]>(`/dashboard/platform/organizations${query ? `?${query}` : ''}`);
  }

  async platformDashboardOrgMetrics(orgId: string, params?: { period?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<OrganizationStats>(`/dashboard/platform/organizations/${orgId}/metrics${query ? `?${query}` : ''}`);
  }

  async platformAnalyticsRevenue(params?: { period?: string; granularity?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<RevenueAnalytics>(`/dashboard/platform/analytics/revenue${query ? `?${query}` : ''}`);
  }

  async platformAnalyticsPolicies(params?: { period?: string; granularity?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<PoliciesAnalytics>(`/dashboard/platform/analytics/policies${query ? `?${query}` : ''}`);
  }

  async platformAnalyticsFarmers(params?: { period?: string; granularity?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<FarmersAnalytics>(`/dashboard/platform/analytics/farmers${query ? `?${query}` : ''}`);
  }

  async platformAnalyticsPayouts(params?: { period?: string; granularity?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<PayoutsAnalytics>(`/dashboard/platform/analytics/payouts${query ? `?${query}` : ''}`);
  }

  async platformAnalyticsDamage(params?: { period?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.request<DamageAnalytics>(`/dashboard/platform/analytics/damage-assessments${query ? `?${query}` : ''}`);
  }

  async platformActivity(limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<Activity[]>(`/dashboard/platform/activity${query}`);
  }

  // ============================================
  // PLATFORM ADMIN - POOLS
  // ============================================

  async platformGetPools() {
    return this.request<{
      total: number;
      pools: {
        address: string;
        name: string;
        symbol: string;
        poolType: number;
        poolValue: string;
        utilizationRate: number;
        organizationId?: string;
        organizationName?: string;
      }[];
    }>('/platform/pools');
  }

  async platformGetPoolCounts() {
    return this.request<{
      total: number;
      public: number;
      private: number;
      mutual: number;
    }>('/platform/pools/counts');
  }

  async platformGetPoolByAddress(poolAddress: string) {
    return this.request<PoolStatus>(`/platform/pools/address/${poolAddress}`);
  }

  async platformDeployPoolForOrg(orgId: string, data: {
    name: string;
    symbol: string;
    poolType: string;
    coverageType: number;
    region: string;
    minDeposit: number;
    maxDeposit: number;
    targetCapital: number;
    maxCapital: number;
    poolOwner?: string;
  }) {
    return this.request<{
      poolAddress: string;
      txHash: string;
      blockNumber: number;
    }>(`/platform/organizations/${orgId}/deploy-pool`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async platformCreatePublicPool(data: {
    name: string;
    symbol: string;
    coverageType: number;
    region: string;
    targetCapital: number;
    maxCapital: number;
  }) {
    return this.request<{
      poolAddress: string;
      txHash: string;
      blockNumber: number;
    }>('/platform/pools/public', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // PLATFORM ADMIN - TREASURY
  // ============================================

  async platformGetTreasury() {
    return this.request<{
      balance: string;
      totalPremiums: string;
      totalPayouts: string;
      accumulatedFees: string;
      platformFeePercent: number;
      reserveRatio: number;
      requiredReserve: string;
      availableForPayouts: string;
      meetsReserve: boolean;
      paused: boolean;
    }>('/platform/treasury');
  }

  async platformGetTreasuryBalance() {
    return this.request<{ balance: string }>('/platform/treasury/balance');
  }

  // ============================================
  // ORGANIZATION ENDPOINTS
  // ============================================

  async getMyOrganization() {
    return this.request<Organization>('/organizations/me');
  }

  async getMyOrganizationStats() {
    return this.request<OrganizationStats>('/organizations/me/stats');
  }

  async updateOrganizationSettings(settings: {
    brandColor?: string;
    webhookUrl?: string;
    contactPhone?: string;
  }) {
    return this.request<Organization>('/organizations/me/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getOrganizationPool() {
    return this.request<LiquidityPool>('/organizations/me/pool');
  }

  async getOrganizationPoolDetails() {
    return this.request<PoolStatus>('/organizations/me/pool/details');
  }

  async depositToPool(data: { amount: number; minTokensOut?: number }) {
    return this.request<{
      txHash: string;
      blockNumber: number;
      tokensMinted: string;
      tokenPrice: string;
    }>('/organizations/me/pool/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async withdrawFromPool(data: { tokenAmount: number; minUsdcOut?: number }) {
    return this.request<{
      txHash: string;
      blockNumber: number;
      usdcReceived: string;
    }>('/organizations/me/pool/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addPoolDepositor(depositorAddress: string) {
    return this.request<{ success: boolean }>('/organizations/me/pool/depositors', {
      method: 'POST',
      body: JSON.stringify({ depositorAddress }),
    });
  }

  async removePoolDepositor(depositorAddress: string) {
    return this.request<{ success: boolean }>(`/organizations/me/pool/depositors/${depositorAddress}`, {
      method: 'DELETE',
    });
  }

  async updatePoolSettings(settings: { depositsOpen?: boolean; withdrawalsOpen?: boolean }) {
    return this.request<PoolSettings>('/organizations/me/pool/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async deployOrgPool(data: {
    name?: string;
    symbol?: string;
    poolType: 'PRIVATE' | 'PUBLIC' | 'MUTUAL';
    coverageType: number;
    region: string;
    targetCapital: number;
    maxCapital?: number;
    minDeposit?: number;
    maxDeposit?: number;
    memberContribution?: number;
    poolOwner?: string;
  }) {
    return this.request<{
      organization: Organization;
      pool: {
        poolAddress: string;
        poolId: string;
        txHash: string;
        blockNumber: number;
      };
    }>('/organizations/me/pool/deploy', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // FARMERS
  // ============================================

  async registerFarmer(data: {
    phoneNumber: string;
    nationalId: string;
    firstName: string;
    lastName: string;
    county: string;
    subCounty?: string;
    ward?: string;
    village?: string;
  }) {
    return this.request<Farmer>('/farmers/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getFarmers(params?: {
    page?: number;
    limit?: number;
    kycStatus?: string;
    county?: string;
    search?: string;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<Farmer[]>(`/farmers${query ? `?${query}` : ''}`);
  }

  async getFarmer(farmerId: string) {
    return this.request<Farmer>(`/farmers/${farmerId}`);
  }

  async updateFarmer(farmerId: string, data: {
    phoneNumber?: string;
    ward?: string;
    village?: string;
  }) {
    return this.request<Farmer>(`/farmers/${farmerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateFarmerKyc(farmerId: string, data: {
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
  }) {
    return this.request<Farmer>(`/farmers/${farmerId}/kyc`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async bulkImportFarmers(farmers: Record<string, unknown>[]) {
    return this.request<{
      imported: number;
      skipped: number;
      errors: { row: number; message: string }[];
      total: number;
    }>('/farmers/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ farmers }),
    });
  }

  async bulkImportPlots(plots: Record<string, unknown>[]) {
    return this.request<{
      imported: number;
      skipped: number;
      errors: { row: number; message: string }[];
      total: number;
    }>('/farmers/bulk-import/plots', {
      method: 'POST',
      body: JSON.stringify({ plots }),
    });
  }

  // ============================================
  // POLICIES
  // ============================================

  async getPolicyQuote(data: {
    farmerId: string;
    plotId: string;
    sumInsured: number;
    coverageType: 'DROUGHT' | 'FLOOD' | 'BOTH';
    durationDays: number;
  }) {
    return this.request<PolicyQuote>('/policies/quote', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async purchasePolicy(data: {
    farmerId: string;
    plotId: string;
    sumInsured: number;
    coverageType: 'DROUGHT' | 'FLOOD' | 'BOTH';
    durationDays: number;
  }) {
    return this.request<Policy>('/policies/purchase', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPolicies(params?: {
    page?: number;
    limit?: number;
    status?: string;
    farmerId?: string;
    plotId?: string;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<Policy[]>(`/policies${query ? `?${query}` : ''}`);
  }

  async getPolicy(policyId: string) {
    return this.request<Policy>(`/policies/${policyId}`);
  }

  async getPolicyStatus(policyId: string) {
    return this.request<{ status: PolicyStatus }>(`/policies/${policyId}/status`);
  }

  async activatePolicy(policyId: string) {
    return this.request<Policy>(`/policies/${policyId}/activate`, {
      method: 'PUT',
    });
  }

  async cancelPolicy(policyId: string, reason: string) {
    return this.request<Policy>(`/policies/${policyId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ============================================
  // PAYOUTS
  // ============================================

  async getPayouts(params?: {
    page?: number;
    limit?: number;
    status?: string;
    farmerId?: string;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<Payout[]>(`/payouts${query ? `?${query}` : ''}`);
  }

  async getPayout(payoutId: string) {
    return this.request<Payout>(`/payouts/${payoutId}`);
  }

  async retryPayout(payoutId: string) {
    return this.request<Payout>(`/payouts/${payoutId}/retry`, {
      method: 'POST',
    });
  }

  async batchRetryPayouts(payoutIds?: string[], retryAllFailed?: boolean) {
    return this.request<{ retried: number }>('/payouts/batch-retry', {
      method: 'POST',
      body: JSON.stringify(
        payoutIds ? { payoutIds } : { retryAllFailed }
      ),
    });
  }

  async getPayoutReconciliation(params?: { startDate?: string; endDate?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ matched: number; unmatched: number; total: number }>(`/payouts/reconciliation${query ? `?${query}` : ''}`);
  }

  // ============================================
  // STAFF MANAGEMENT
  // ============================================

  async getStaff() {
    return this.request<User[]>('/staff');
  }

  async inviteStaff(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: 'ORG_ADMIN' | 'ORG_STAFF';
  }) {
    return this.request<User>('/staff/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStaffRole(userId: string, role: 'ORG_ADMIN' | 'ORG_STAFF') {
    return this.request<User>(`/staff/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async deactivateStaff(userId: string) {
    return this.request<User>(`/staff/${userId}/deactivate`, {
      method: 'PUT',
    });
  }

  async reactivateStaff(userId: string) {
    return this.request<User>(`/staff/${userId}/reactivate`, {
      method: 'PUT',
    });
  }

  // ============================================
  // ORG DASHBOARD
  // ============================================

  async orgDashboardOverview(params?: { period?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<OrganizationStats>(`/dashboard/org/overview${query ? `?${query}` : ''}`);
  }

  async orgDashboardFarmers(params?: {
    period?: string;
    page?: number;
    limit?: number;
    kycStatus?: string;
    county?: string;
    search?: string;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<Farmer[]>(`/dashboard/org/farmers${query ? `?${query}` : ''}`);
  }

  async orgDashboardFarmersAnalytics(params?: { period?: string; granularity?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<FarmersAnalytics>(`/dashboard/org/farmers/analytics${query ? `?${query}` : ''}`);
  }

  async orgDashboardPolicies(params?: { period?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<PoliciesAnalytics>(`/dashboard/org/policies${query ? `?${query}` : ''}`);
  }

  async orgDashboardPoliciesAnalytics(params?: { period?: string; granularity?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<PoliciesAnalytics>(`/dashboard/org/policies/analytics${query ? `?${query}` : ''}`);
  }

  async orgDashboardPayouts(params?: { period?: string; granularity?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<PayoutsAnalytics>(`/dashboard/org/payouts${query ? `?${query}` : ''}`);
  }

  async orgDashboardDamageAssessments(params?: { period?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.request<DamageAnalytics>(`/dashboard/org/damage-assessments${query ? `?${query}` : ''}`);
  }

  async orgDashboardFinancials(params?: { period?: string; granularity?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<FinancialSummary>(`/dashboard/org/financials${query ? `?${query}` : ''}`);
  }

  async orgDashboardPlots(params?: { page?: number; limit?: number; cropType?: string }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<Plot[]>(`/dashboard/org/plots${query ? `?${query}` : ''}`);
  }

  async orgDashboardActivity(limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<Activity[]>(`/dashboard/org/activity${query}`);
  }

  // ============================================
  // EXPORTS
  // ============================================

  async exportFarmers(params?: { period?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.downloadFile(`/export/farmers${query ? `?${query}` : ''}`);
  }

  async exportPolicies(params?: { period?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.downloadFile(`/export/policies${query ? `?${query}` : ''}`);
  }

  async exportPayouts(params?: { period?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.downloadFile(`/export/payouts${query ? `?${query}` : ''}`);
  }

  async exportTransactions(params?: { period?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.downloadFile(`/export/transactions${query ? `?${query}` : ''}`);
  }

  async exportPlatformOrganizations(params?: { period?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.downloadFile(`/export/platform/organizations${query ? `?${query}` : ''}`);
  }

  async exportPlatformRevenue(params?: { period?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.downloadFile(`/export/platform/revenue${query ? `?${query}` : ''}`);
  }

  private async downloadFile(endpoint: string): Promise<Blob> {
    const url = `${this.baseUrl}/api${endpoint}`;

    const headers: HeadersInit = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response: Response;
    try {
      response = await fetch(url, { headers });
    } catch (err) {
      throw new ApiError('Network error. Please check your connection.', 0);
    }

    if (!response.ok) {
      if (response.status === 401) {
        this.handleAuthError();
      }
      throw new ApiError('Failed to download file', response.status);
    }

    return response.blob();
  }

  // ============================================
  // KYB ENDPOINTS (TO BE IMPLEMENTED BY BACKEND)
  // See: docs/BACKEND_KYB_IMPLEMENTATION.md
  // ============================================

  /**
   * @todo Backend needs to implement this endpoint
   * POST /api/applications/organization
   */
  async submitOrgApplication(formData: FormData) {
    return this.uploadRequest<OrganizationApplication>('/applications/organization', formData);
  }

  /**
   * @todo Backend needs to implement this endpoint
   * GET /api/applications/organization
   */
  async getOrgApplications(params?: { status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<OrganizationApplication[]>(`/applications/organization${query ? `?${query}` : ''}`);
  }

  /**
   * @todo Backend needs to implement this endpoint
   * GET /api/applications/organization/:id
   */
  async getOrgApplication(applicationId: string) {
    return this.request<OrganizationApplication>(`/applications/organization/${applicationId}`);
  }

  /**
   * @todo Backend needs to implement this endpoint
   * POST /api/applications/organization/:id/verify
   */
  async verifyKybApplication(applicationId: string, data: {
    status: 'VERIFIED' | 'REJECTED';
    reviewNotes?: string;
  }) {
    return this.request<OrganizationApplication>(`/applications/organization/${applicationId}/verify`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * @todo Backend needs to implement this endpoint
   * POST /api/invitations
   */
  async createInvitation(data: {
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
  }) {
    return this.request<OrgAdminInvitation>('/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * @todo Backend needs to implement this endpoint
   * POST /api/invitations/:id/send
   */
  async sendInvitation(invitationId: string) {
    return this.request<OrgAdminInvitation>(`/invitations/${invitationId}/send`, {
      method: 'POST',
    });
  }

  /**
   * @todo Backend needs to implement this endpoint
   * GET /api/invitations
   */
  async getInvitations(params?: { organizationId?: string; status?: string }) {
    // Filter out undefined values before creating query string
    const filteredParams = params
      ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
      : {};
    const query = new URLSearchParams(filteredParams as Record<string, string>).toString();
    return this.requestWithPagination<OrgAdminInvitation[]>(`/invitations${query ? `?${query}` : ''}`);
  }

  /**
   * @todo Backend needs to implement this endpoint
   * GET /api/invitations/validate/:token
   */
  async validateInvitationToken(token: string) {
    return this.request<{
      valid: boolean;
      invitation?: OrgAdminInvitation;
      error?: string;
    }>(`/invitations/validate/${token}`);
  }

  /**
   * @todo Backend needs to implement this endpoint
   * POST /api/invitations/accept
   */
  async acceptInvitation(token: string, password: string) {
    return this.request<{
      user: User;
      message: string;
    }>('/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  /**
   * @todo Backend needs to implement this endpoint
   * GET /api/kyb/pending-count
   */
  async getPendingKybCount() {
    return this.request<{ count: number }>('/kyb/pending-count');
  }
}

// Create singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export for use in auth store
export default apiClient;
