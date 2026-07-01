/**
 * API Client for MicroCrop Backend
 *
 * Base URL configured via environment variable:
 * - Development: VITE_API_URL=http://localhost:3000
 * - Production: VITE_API_URL=https://api.microcrop.app
 */

import type { User, Organization, OnboardingStep, OrganizationStats, PlatformStats, RevenueAnalytics, PoliciesAnalytics, FarmersAnalytics, PayoutsAnalytics, DamageAnalytics, Activity, ReserveStatus, OrgKyb, OrgKybVerification, OrgKybReview, Farmer, Plot, Policy, PolicyQuote, PolicyStatus, CoverageType, Payout, FinancialSummary, OrganizationApplication, OrgAdminInvitation, GeoJsonPolygon, PlotBoundary, NdviReading, PlotHealth, SatelliteMonitoringOverview, DamageVerification, DamageAssessment, FraudFlag, FraudSummary, FraudFlagStatus, GpsPoint, GpsTrackResponse, KycFieldVerifyResponse, PaymentInitiateResponse, PaymentStatusResponse, BlogPost, BlogCategory, BlogTag, PostStatus, UploadResult, WebhookConfig, WebhookDelivery, WebhookDeliveryStatus, ApiKeyStatus, ApiKeyRotateResult } from '@/types';

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

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: ApiErrorDetail[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private onAuthError: (() => void) | null = null;
  private onDeactivated: (() => void) | null = null;

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

  /** Register a callback for "Organization is deactivated" responses */
  onOrgDeactivated(callback: () => void) {
    this.onDeactivated = callback;
  }

  private handleAuthError() {
    if (this.onAuthError) {
      this.onAuthError();
    }
  }

  private handleDeactivatedError() {
    if (this.onDeactivated) {
      this.onDeactivated();
    }
  }

  private isDeactivatedError(status: number, message: string): boolean {
    return status === 403 && message.toLowerCase().includes('deactivated');
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

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        `Server returned invalid response (HTTP ${response.status})`,
        response.status,
        'INVALID_RESPONSE'
      );
    }

    if (!response.ok) {
      const error = data as ApiErrorResponse;
      const message = error.error?.message || 'An error occurred';

      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        this.handleAuthError();
      } else if (this.isDeactivatedError(response.status, message)) {
        this.handleDeactivatedError();
      }

      throw new ApiError(message, response.status, error.error?.code, error.error?.details);
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

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new ApiError(
        `Server returned invalid response (HTTP ${response.status})`,
        response.status,
        'INVALID_RESPONSE'
      );
    }

    if (!response.ok) {
      const error = result as ApiErrorResponse;
      const message = error.error?.message || 'An error occurred';

      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        this.handleAuthError();
      } else if (this.isDeactivatedError(response.status, message)) {
        this.handleDeactivatedError();
      }

      throw new ApiError(message, response.status, error.error?.code, error.error?.details);
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

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        `Server returned invalid response (HTTP ${response.status})`,
        response.status,
        'INVALID_RESPONSE'
      );
    }

    if (!response.ok) {
      const error = data as ApiErrorResponse;
      const message = error.error?.message || 'An error occurred';

      if (response.status === 401) {
        this.handleAuthError();
      } else if (this.isDeactivatedError(response.status, message)) {
        this.handleDeactivatedError();
      }

      throw new ApiError(message, response.status, error.error?.code, error.error?.details);
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

  // Self-service organization signup (creates org + first ORG_ADMIN, immediate login).
  async registerOrganization(data: {
    organizationName: string;
    registrationNumber: string;
    type: string;
    county?: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
  }) {
    const result = await this.request<{
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        organizationId?: string;
      };
      organization: { id: string; name: string };
      accessToken: string;
      refreshToken: string;
    }>('/auth/register-organization', {
      method: 'POST',
      body: JSON.stringify(data),
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
    }>('/auth/refresh-token', {
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
      body: JSON.stringify({ email, resetBaseUrl: window.location.origin }),
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
    return this.request<Organization>(`/platform/organizations/${encodeURIComponent(orgId)}`);
  }

  async platformConfigureOrganization(orgId: string, config: {
    ussdShortCode?: string;
    brandName?: string;
    brandColor?: string;
    logoUrl?: string;
    webhookUrl?: string;
  }) {
    return this.request<Organization>(`/platform/organizations/${encodeURIComponent(orgId)}/configure`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // Per-org treasury (v3): provision the org's wallet (reserve key) + set its reserve ratio.
  async platformProvisionWallet(orgId: string) {
    return this.request<{ walletAddress: string; privyWalletId: string; alreadyProvisioned: boolean }>(
      `/platform/organizations/${encodeURIComponent(orgId)}/provision-wallet`,
      { method: 'POST' }
    );
  }

  async platformSetReserveRatio(orgId: string, ratioBps: number) {
    return this.request<{ orgId: string; walletAddress: string; ratioBps: number; txHash: string }>(
      `/platform/organizations/${encodeURIComponent(orgId)}/reserve-ratio`,
      { method: 'POST', body: JSON.stringify({ ratioBps }) }
    );
  }

  async platformActivateOrganization(orgId: string) {
    return this.request<Organization>(`/platform/organizations/${encodeURIComponent(orgId)}/activate`, {
      method: 'POST',
    });
  }

  async platformDeactivateOrganization(orgId: string) {
    return this.request<Organization>(`/platform/organizations/${encodeURIComponent(orgId)}/deactivate`, {
      method: 'POST',
    });
  }

  async platformGetOnboardingStatus(orgId: string) {
    return this.request<{ step: OnboardingStep; completedSteps: OnboardingStep[] }>(`/platform/organizations/${encodeURIComponent(orgId)}/onboarding-status`);
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
    return this.request<OrganizationStats>(`/dashboard/platform/organizations/${encodeURIComponent(orgId)}/metrics${query ? `?${query}` : ''}`);
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

  // ============================================
  // ORGANIZATION RESERVE (per-org treasury / v3)
  // ============================================

  async getReserve() {
    return this.request<ReserveStatus>('/organizations/me/reserve');
  }

  async depositReserve(data: { amountUsdc: number }) {
    return this.request<{ txHash: string; amountUsdc: number }>('/organizations/me/reserve/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async withdrawReserve(data: { amountUsdc: number; to?: string }) {
    return this.request<{ txHash: string; amountUsdc: number; to: string }>('/organizations/me/reserve/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // ORGANIZATION KYB (in-dashboard verification)
  // ============================================

  async getMyKyb() {
    return this.request<OrgKyb>('/organizations/me/kyb');
  }

  async submitMyKyb(formData: FormData) {
    return this.uploadRequest<OrgKybVerification>('/organizations/me/kyb', formData);
  }

  async getKybReviews() {
    return this.request<OrgKybReview[]>('/platform/organizations/kyb-reviews');
  }

  async getOrgKyb(orgId: string) {
    return this.request<OrgKyb>(`/platform/organizations/${encodeURIComponent(orgId)}/kyb`);
  }

  async reviewOrgKyb(orgId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) {
    return this.request<{ id: string; kybStatus: string }>(
      `/platform/organizations/${encodeURIComponent(orgId)}/kyb/review`,
      { method: 'POST', body: JSON.stringify({ decision, notes }) }
    );
  }

  // ============================================
  // ORGANIZATION WALLET
  // ============================================

  async getOrgWallet() {
    return this.request<{
      walletAddress: string | null;
      walletCreated: boolean;
      balances?: { usdc: string; eth: string };
      message?: string;
    }>('/organizations/me/wallet');
  }

  async fundWallet(data: { phoneNumber: string; amountKES: number }) {
    return this.request<{
      transactionId: string;
      reference: string;
      orderId: string;
      provider: string;
      status: string;
      walletAddress: string;
      instructions: string;
    }>('/organizations/me/wallet/fund', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // ORGANIZATION WEBHOOKS (partner integration)
  // ============================================

  async getWebhookConfig() {
    return this.request<WebhookConfig>('/organizations/me/webhook');
  }

  async setWebhookConfig(url: string) {
    return this.request<WebhookConfig>('/organizations/me/webhook', {
      method: 'PUT',
      body: JSON.stringify({ url }),
    });
  }

  async rotateWebhookSecret() {
    return this.request<{ secret: string }>('/organizations/me/webhook/rotate-secret', {
      method: 'POST',
    });
  }

  async getWebhookDeliveries(params?: { status?: WebhookDeliveryStatus; page?: number; limit?: number }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.request<{ deliveries: WebhookDelivery[]; total: number; page: number; limit: number }>(
      `/organizations/me/webhook/deliveries${query ? `?${query}` : ''}`
    );
  }

  async retryWebhookDelivery(id: string) {
    return this.request<{ id: string; event: string; status: WebhookDeliveryStatus; attempts: number }>(
      `/organizations/me/webhook/deliveries/${encodeURIComponent(id)}/retry`,
      { method: 'POST' }
    );
  }

  // ============================================
  // ORGANIZATION API KEY (rotate-only)
  // ============================================

  async getApiKey() {
    return this.request<ApiKeyStatus>('/organizations/me/api-key');
  }

  async rotateApiKey() {
    return this.request<ApiKeyRotateResult>('/organizations/me/api-key/rotate', {
      method: 'POST',
    });
  }

  async revokeApiKey() {
    return this.request<ApiKeyStatus>('/organizations/me/api-key/revoke', {
      method: 'POST',
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
    return this.request<Farmer>(`/farmers/${encodeURIComponent(farmerId)}`);
  }

  async updateFarmer(farmerId: string, data: {
    phoneNumber?: string;
    ward?: string;
    village?: string;
  }) {
    return this.request<Farmer>(`/farmers/${encodeURIComponent(farmerId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateFarmerKyc(farmerId: string, data: {
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
  }) {
    return this.request<Farmer>(`/farmers/${encodeURIComponent(farmerId)}/kyc`, {
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

  // ============================================
  // PLOTS
  // ============================================

  async createPlot(farmerId: string, data: {
    name: string;
    latitude: number;
    longitude: number;
    acreage: number;
    cropType: string;
    plantingDate?: string;
  }) {
    return this.request<Plot>('/plots', {
      method: 'POST',
      body: JSON.stringify({ farmerId, ...data }),
    });
  }

  async getPlot(plotId: string) {
    return this.request<Plot>(`/plots/${encodeURIComponent(plotId)}`);
  }

  async updatePlot(plotId: string, data: {
    name?: string;
    latitude?: number;
    longitude?: number;
    acreage?: number;
    cropType?: string;
  }) {
    return this.request<Plot>(`/plots/${encodeURIComponent(plotId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
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
    productType?: 'CROP' | 'LIVESTOCK';
    plotId?: string;
    herdId?: string;
    sumInsured: number;
    coverageType: CoverageType;
    durationDays: number;
    season?: 'LRLD' | 'SRSD';
  }) {
    return this.request<PolicyQuote>('/policies/quote', {
      method: 'POST',
      body: JSON.stringify({ productType: 'CROP', ...data }),
    });
  }

  async purchasePolicy(data: {
    farmerId: string;
    productType?: 'CROP' | 'LIVESTOCK';
    plotId?: string;
    herdId?: string;
    sumInsured: number;
    coverageType: CoverageType;
    durationDays: number;
    season?: 'LRLD' | 'SRSD';
  }) {
    return this.request<Policy>('/policies/purchase', {
      method: 'POST',
      body: JSON.stringify({ productType: 'CROP', ...data }),
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
    return this.request<Policy>(`/policies/${encodeURIComponent(policyId)}`);
  }

  async getPolicyStatus(policyId: string) {
    return this.request<{ status: PolicyStatus }>(`/policies/${encodeURIComponent(policyId)}/status`);
  }

  async activatePolicy(policyId: string) {
    return this.request<Policy>(`/policies/${encodeURIComponent(policyId)}/activate`, {
      method: 'PUT',
    });
  }


  async cancelPolicy(policyId: string, reason: string) {
    return this.request<Policy>(`/policies/${encodeURIComponent(policyId)}/cancel`, {
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
    return this.request<Payout>(`/payouts/${encodeURIComponent(payoutId)}`);
  }

  async retryPayout(payoutId: string) {
    return this.request<Payout>(`/payouts/${encodeURIComponent(payoutId)}/retry`, {
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
    return this.request<User>(`/staff/${encodeURIComponent(userId)}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async deactivateStaff(userId: string) {
    return this.request<User>(`/staff/${encodeURIComponent(userId)}/deactivate`, {
      method: 'PUT',
    });
  }

  async reactivateStaff(userId: string) {
    return this.request<User>(`/staff/${encodeURIComponent(userId)}/reactivate`, {
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
    return this.request<OrganizationApplication>(`/applications/organization/${encodeURIComponent(applicationId)}`);
  }

  /**
   * @todo Backend needs to implement this endpoint
   * POST /api/applications/organization/:id/verify
   */
  async verifyKybApplication(applicationId: string, data: {
    status: 'VERIFIED' | 'REJECTED';
    reviewNotes?: string;
  }) {
    return this.request<OrganizationApplication>(`/applications/organization/${encodeURIComponent(applicationId)}/verify`, {
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
    return this.request<OrgAdminInvitation>(`/invitations/${encodeURIComponent(invitationId)}/send`, {
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
    }>(`/invitations/validate/${encodeURIComponent(token)}`);
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

  // ============================================
  // SATELLITE MONITORING
  // ============================================

  async setPlotBoundary(plotId: string, boundary: GeoJsonPolygon) {
    return this.request<{
      plot: PlotBoundary;
      overlaps: unknown | null;
      overlapWarning: string | null;
    }>(`/satellite/plots/${encodeURIComponent(plotId)}/boundary`, {
      method: 'POST',
      body: JSON.stringify({ boundary }),
    });
  }

  async getPlotBoundary(plotId: string) {
    return this.request<PlotBoundary>(`/satellite/plots/${encodeURIComponent(plotId)}/boundary`);
  }

  async getPlotNdvi(plotId: string, params?: { from?: string; to?: string; source?: string }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.request<NdviReading[]>(`/satellite/plots/${encodeURIComponent(plotId)}/ndvi${query ? `?${query}` : ''}`);
  }

  async getPlotHealth(plotId: string) {
    return this.request<PlotHealth>(`/satellite/plots/${encodeURIComponent(plotId)}/health`);
  }

  async getPlotSatelliteHistory(plotId: string, params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<unknown[]>(`/satellite/plots/${encodeURIComponent(plotId)}/satellite${query ? `?${query}` : ''}`);
  }

  async fetchPlotNdvi(plotId: string) {
    return this.request<{
      plotId: string;
      reading: NdviReading;
    }>(`/satellite/plots/${encodeURIComponent(plotId)}/ndvi/fetch`, {
      method: 'POST',
    });
  }

  async getSatelliteMonitoring(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<SatelliteMonitoringOverview>(`/satellite/monitoring${query ? `?${query}` : ''}`);
  }

  async getSatelliteAnomalies(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<DamageAssessment[]>(`/satellite/monitoring/anomalies${query ? `?${query}` : ''}`);
  }

  async verifyDamageAssessment(assessmentId: string) {
    return this.request<DamageVerification>(`/satellite/damage-assessments/${encodeURIComponent(assessmentId)}/verify`);
  }

  async getFraudFlags(params?: {
    type?: string;
    severity?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<FraudFlag[]>(`/satellite/fraud/flags${query ? `?${query}` : ''}`);
  }

  async resolveFraudFlag(flagId: string, data: { status: FraudFlagStatus; resolution: string }) {
    return this.request<FraudFlag>(`/satellite/fraud/flags/${encodeURIComponent(flagId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getFraudSummary() {
    return this.request<FraudSummary>('/satellite/fraud/summary');
  }

  // ============================================
  // FIELD ONBOARDING
  // ============================================

  async fieldVerifyKyc(farmerId: string) {
    return this.request<KycFieldVerifyResponse>(`/farmers/${encodeURIComponent(farmerId)}/kyc/field-verify`, {
      method: 'PUT',
    });
  }

  async submitGpsTrack(plotId: string, data: {
    points: GpsPoint[];
    accuracyThreshold?: number;
  }) {
    return this.request<GpsTrackResponse>(`/satellite/plots/${encodeURIComponent(plotId)}/boundary/gps-track`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPlotBoundaryReview(plotId: string) {
    return this.request<PlotBoundary>(`/satellite/plots/${encodeURIComponent(plotId)}/boundary`);
  }

  async initiatePayment(data: { policyId: string; phoneNumber: string }) {
    return this.request<PaymentInitiateResponse>('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPaymentStatusByRef(reference: string) {
    return this.request<PaymentStatusResponse>(`/payments/status/${encodeURIComponent(reference)}`);
  }

  // ============================================
  // PROFILE
  // ============================================

  async updateMyProfile(data: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    displayRole?: string | null;
  }) {
    return this.request<User>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // BLOG - UPLOADS
  // ============================================

  async uploadBlogImage(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('image', file);
    return this.uploadRequest<UploadResult>('/dashboard/platform/blog/uploads', formData);
  }

  // ============================================
  // BLOG - POSTS
  // ============================================

  async getBlogPosts(params?: {
    page?: number;
    pageSize?: number;
    status?: PostStatus;
    categoryId?: string;
    search?: string;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<BlogPost[]>(`/dashboard/platform/blog/posts${query ? `?${query}` : ''}`);
  }

  async getBlogPost(id: string) {
    return this.request<BlogPost>(`/dashboard/platform/blog/posts/${encodeURIComponent(id)}`);
  }

  async createBlogPost(data: {
    title: string;
    slug?: string;
    excerpt: string;
    body: string;
    coverImagePath?: string;
    coverImageAlt?: string;
    coverImageWidth?: number;
    coverImageHeight?: number;
    metaTitle?: string;
    metaDescription?: string;
    ogImagePath?: string;
    categoryId?: string | null;
    tagSlugs?: string[];
  }) {
    return this.request<BlogPost>('/dashboard/platform/blog/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBlogPost(id: string, data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    body?: string;
    coverImagePath?: string | null;
    coverImageAlt?: string | null;
    coverImageWidth?: number | null;
    coverImageHeight?: number | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    ogImagePath?: string | null;
    categoryId?: string | null;
    tagSlugs?: string[];
  }) {
    return this.request<BlogPost>(`/dashboard/platform/blog/posts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteBlogPost(id: string) {
    return this.request<{ success: boolean }>(`/dashboard/platform/blog/posts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async publishBlogPost(id: string, scheduledFor?: string) {
    return this.request<BlogPost>(`/dashboard/platform/blog/posts/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: JSON.stringify(scheduledFor ? { scheduledFor } : {}),
    });
  }

  async unpublishBlogPost(id: string) {
    return this.request<BlogPost>(`/dashboard/platform/blog/posts/${encodeURIComponent(id)}/unpublish`, {
      method: 'POST',
    });
  }

  // ============================================
  // BLOG - CATEGORIES
  // ============================================

  async getBlogCategories() {
    return this.request<BlogCategory[]>('/dashboard/platform/blog/categories');
  }

  async createBlogCategory(data: { name: string; slug?: string; description?: string }) {
    return this.request<BlogCategory>('/dashboard/platform/blog/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBlogCategory(id: string, data: { name?: string; slug?: string; description?: string }) {
    return this.request<BlogCategory>(`/dashboard/platform/blog/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteBlogCategory(id: string) {
    return this.request<{ success: boolean }>(`/dashboard/platform/blog/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // BLOG - TAGS
  // ============================================

  async getBlogTags() {
    return this.request<BlogTag[]>('/dashboard/platform/blog/tags');
  }

  async createBlogTag(data: { name: string; slug?: string }) {
    return this.request<BlogTag>('/dashboard/platform/blog/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteBlogTag(id: string) {
    return this.request<{ success: boolean }>(`/dashboard/platform/blog/tags/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // HERDS
  // ============================================

  async createHerd(data: {
    farmerId: string;
    name: string;
    livestockType: string;
    headCount: number;
    estimatedValue: number;
    insuranceUnitId?: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.request<import('@/types').Herd>('/herds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getHerds(params?: {
    page?: number;
    limit?: number;
    livestockType?: string;
    farmerId?: string;
    search?: string;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<import('@/types').Herd[]>(`/herds${query ? `?${query}` : ''}`);
  }

  async getHerd(herdId: string) {
    return this.request<import('@/types').Herd>(`/herds/${encodeURIComponent(herdId)}`);
  }

  async updateHerd(herdId: string, data: {
    name?: string;
    headCount?: number;
    estimatedValue?: number;
    insuranceUnitId?: string;
  }) {
    return this.request<import('@/types').Herd>(`/herds/${encodeURIComponent(herdId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // INSURANCE UNITS (Platform Admin)
  // ============================================

  async getInsuranceUnits(params?: {
    page?: number;
    limit?: number;
    country?: string;
    isActive?: boolean;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<import('@/types').InsuranceUnit[]>(`/insurance-units${query ? `?${query}` : ''}`);
  }

  async createInsuranceUnit(data: {
    county: string;
    subCounty?: string;
    unitCode: string;
    country: string;
    bbox?: number[];
    ndviBaselineLRLD: number;
    ndviBaselineSRSD: number;
    strikeLevelLRLD: number;
    strikeLevelSRSD: number;
    premiumRateLRLD: number;
    premiumRateSRSD: number;
    valuePerTLU?: number;
  }) {
    return this.request<import('@/types').InsuranceUnit>('/insurance-units', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInsuranceUnit(id: string) {
    return this.request<import('@/types').InsuranceUnit>(`/insurance-units/${encodeURIComponent(id)}`);
  }

  async updateInsuranceUnit(id: string, data: Partial<{
    county: string;
    subCounty: string;
    unitCode: string;
    country: string;
    bbox: number[];
    ndviBaselineLRLD: number;
    ndviBaselineSRSD: number;
    strikeLevelLRLD: number;
    strikeLevelSRSD: number;
    premiumRateLRLD: number;
    premiumRateSRSD: number;
    valuePerTLU: number;
    isActive: boolean;
  }>) {
    return this.request<import('@/types').InsuranceUnit>(`/insurance-units/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // INSURANCE UNITS (Org - Read Only, for onboarding dropdowns)
  // ============================================

  async getActiveInsuranceUnits(country?: string) {
    const params = new URLSearchParams({ isActive: 'true' });
    if (country) params.set('country', country);
    return this.requestWithPagination<import('@/types').InsuranceUnit[]>(`/insurance-units?${params.toString()}`);
  }

  // ============================================
  // FORAGE ALERTS (livestock / IBLI forage-failure feed)
  // ============================================

  async getForageAlerts(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<import('@/types').ForageAlert[]>(
      `/dashboard/org/forage-alerts${query ? `?${query}` : ''}`
    );
  }

  // ============================================
  // PLATFORM — PER-ORG RESERVE READ (solvency)
  // ============================================

  async getOrgReserve(orgId: string) {
    return this.request<ReserveStatus & { message?: string }>(
      `/platform/organizations/${encodeURIComponent(orgId)}/reserve`
    );
  }
}

// Create singleton instance
export const apiClient = new ApiClient(API_BASE_URL);
