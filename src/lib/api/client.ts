/**
 * API Client for MicroCrop Backend
 *
 * Base URL configured via environment variable:
 * - Development: VITE_API_URL=http://localhost:3000
 * - Production: VITE_API_URL=https://api.microcrop.app
 */

import type { User, Organization, OnboardingStep, OrganizationStats, PoliciesAnalytics, FarmersAnalytics, PayoutsAnalytics, DamageAnalytics, Activity, ReserveStatus, OrgKyb, OrgKybVerification, OrgKybReview, Farmer, Plot, Policy, PolicyQuote, PolicyPurchaseResponse, PolicyStatus, CoverageType, Payout, FinancialSummary, OrganizationApplication, OrgAdminInvitation, GeoJsonPolygon, PlotBoundary, NdviReading, PlotHealth, SatelliteMonitoringOverview, DamageVerification, DamageAssessment, FraudFlag, FraudSummary, FraudFlagStatus, GpsPoint, GpsTrackResponse, KycFieldVerifyResponse, PaymentInitiateResponse, PaymentStatusResponse, BlogPost, BlogCategory, BlogTag, PostStatus, UploadResult, WebhookConfig, WebhookDelivery, WebhookDeliveryStatus, ApiKeyStatus, ApiKeyRotateResult, OrgRole, WeatherMarket, WeatherStationCoverage, PlotCoverage, ConsentMethod, ConsentDocumentsResponse, FarmerConsentStatus, RecordConsentResponse, WithdrawConsentResponse, PartnerDetermination, DeterminationStatus, EvidencePackage, SettlementReportInput, SettlementReportResult, SettlementReportsResponse, OrgCapability, OrgCapabilityStatus, OrgCapabilitiesResponse, SetOrgCapabilityResult, PlatformAnalyticsQuery } from '@/types';
import type { CatalogueResponse } from '@/types/catalogue';

/**
 * `?a=1&b=2` from a params object, dropping undefined/null/'' so an unset filter is absent rather
 * than sent as the string "undefined". Empty string when nothing is left.
 */
function toQuery(params?: object): string {
  const entries = Object.entries(params ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

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
    // A per-field ARRAY on a validation failure (Joi), a structured OBJECT on a domain refusal.
    details?: ApiErrorDetail[] | Record<string, unknown>;
  };
}

/**
 * The response of every bulk import (farmers, plots, herds), HTTP 201. `errors[].row` is 1-BASED;
 * `skipped` is `total - imported`, so it already includes every errored row.
 */
export interface BulkImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; field?: string; message: string }[];
  total: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: ApiErrorDetail[],
    /**
     * The structured OBJECT form of `error.details`, which a domain refusal carries instead of a
     * field list — PRODUCT_NOT_OFFERED sends `{ countryCode, line, item, status }`. Kept apart
     * from `details` so that field stays what its type says: an array. Before this split the
     * object landed in `details` and the import report's `.map` over it threw.
     */
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Route the wire's `details` to the field matching its shape. */
function splitErrorDetails(
  raw: unknown,
): [ApiErrorDetail[] | undefined, Record<string, unknown> | undefined] {
  if (Array.isArray(raw)) return [raw as ApiErrorDetail[], undefined];
  if (raw && typeof raw === 'object') return [undefined, raw as Record<string, unknown>];
  return [undefined, undefined];
}

/**
 * How a token refresh ended, as seen by requests held behind it (see setAuthGate).
 * 'unavailable' means the server could not be asked (rate limit, network, 5xx).
 */
export type AuthGateOutcome = 'refreshed' | 'loggedOut' | 'unavailable';

// A refresh that has not answered by now is treated as a network failure (status 0, transient),
// so a stalled connection cannot hold the cross-tab refresh lock and the request gate forever.
export const REFRESH_TIMEOUT_MS = 15 * 1000;

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private onAuthError: (() => void) | null = null;
  private onDeactivated: (() => void) | null = null;
  private refreshHandler: (() => Promise<string | null>) | null = null;
  private authGate: Promise<AuthGateOutcome> | null = null;

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

  /**
   * Register how to obtain a fresh access token after a 401. The handler resolves to the new
   * access token, or to null when the session is over (the caller then falls through to
   * onUnauthorized). It throws when the refresh could not be completed for a transient reason
   * (rate limit, network), in which case the 401 is surfaced WITHOUT logging the user out.
   */
  onRefreshNeeded(handler: () => Promise<string | null>) {
    this.refreshHandler = handler;
  }

  /**
   * While set, authenticated requests wait for this promise before they are sent. The auth
   * store sets it for the duration of a token refresh, so a request fired during the refresh
   * that follows a page reload (when there is no access token yet) is held instead of going
   * out bare, 401ing and logging the user out.
   */
  setAuthGate(gate: Promise<AuthGateOutcome> | null) {
    this.authGate = gate;
  }

  /** The unauthenticated credential endpoints: never gated, never refresh-and-retried. */
  private isCredentialEndpoint(endpoint: string): boolean {
    return /^\/auth\/(login|register|register-organization|refresh-token|forgot-password|reset-password)(\?|$)/.test(
      endpoint
    );
  }

  /**
   * Send a request with the current access token. For authenticated endpoints:
   * - waits for an in-flight token refresh first (see setAuthGate);
   * - on 401, asks for ONE refresh (shared with any refresh already running) and retries once
   *   with the new token. If the token changed while the request was in flight, it just retries.
   *
   * `logoutOn401` is false when a 401 must not end the session: a credential endpoint, or a
   * refresh that failed for a transient reason. The caller still throws the 401 as an ApiError.
   */
  private async send(
    endpoint: string,
    init: RequestInit,
    baseHeaders: Record<string, string>
  ): Promise<{ response: Response; logoutOn401: boolean }> {
    const url = `${this.baseUrl}/api${endpoint}`;
    const authenticated = !this.isCredentialEndpoint(endpoint);

    if (authenticated && this.authGate) {
      let outcome: AuthGateOutcome | undefined;
      try {
        outcome = await this.authGate;
      } catch {
        // The gate only orders requests after the refresh; its outcome is handled elsewhere.
      }
      if (outcome === 'unavailable' && !this.accessToken) {
        // The refresh we waited for could not reach the server and there is no token to send.
        // Going out bare would only 401 and start a second refresh that ignores retryAfter.
        throw new ApiError('Session refresh is temporarily unavailable.', 0);
      }
    }

    const attempt = async (): Promise<{ response: Response; tokenUsed: string | null }> => {
      const tokenUsed = this.accessToken;
      const headers: Record<string, string> = { ...baseHeaders };
      if (tokenUsed) {
        headers['Authorization'] = `Bearer ${tokenUsed}`;
      }
      try {
        return { response: await fetch(url, { ...init, headers }), tokenUsed };
      } catch {
        throw new ApiError('Network error. Please check your connection.', 0);
      }
    };

    const first = await attempt();
    if (first.response.status !== 401 || !authenticated || !this.refreshHandler) {
      return { response: first.response, logoutOn401: authenticated };
    }

    let token: string | null = this.accessToken;
    if (!token || token === first.tokenUsed) {
      try {
        token = await this.refreshHandler();
      } catch {
        // Could not refresh right now (rate limit, network). Keep the session.
        return { response: first.response, logoutOn401: false };
      }
    }
    if (!token) {
      return { response: first.response, logoutOn401: true };
    }

    const retried = await attempt();
    return { response: retried.response, logoutOn401: true };
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
    const { response, logoutOn401 } = await this.send(endpoint, options, {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    });

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

      if (response.status === 401 && logoutOn401 && !endpoint.startsWith('/auth/')) {
        this.handleAuthError();
      } else if (this.isDeactivatedError(response.status, message)) {
        this.handleDeactivatedError();
      }

      throw new ApiError(message, response.status, error.error?.code, ...splitErrorDetails(error.error?.details));
    }

    return (data as ApiResponse<T>).data;
  }

  private async requestWithPagination<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; pagination?: ApiResponse<T>['pagination'] }> {
    const { response, logoutOn401 } = await this.send(endpoint, options, {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    });

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

      if (response.status === 401 && logoutOn401 && !endpoint.startsWith('/auth/')) {
        this.handleAuthError();
      } else if (this.isDeactivatedError(response.status, message)) {
        this.handleDeactivatedError();
      }

      throw new ApiError(message, response.status, error.error?.code, ...splitErrorDetails(error.error?.details));
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
    // Don't set Content-Type for FormData - browser will set it with boundary
    const { response, logoutOn401 } = await this.send(
      endpoint,
      { method: 'POST', body: formData },
      {}
    );

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

      if (response.status === 401 && logoutOn401) {
        this.handleAuthError();
      } else if (this.isDeactivatedError(response.status, message)) {
        this.handleDeactivatedError();
      }

      throw new ApiError(message, response.status, error.error?.code, ...splitErrorDetails(error.error?.details));
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

  /**
   * Self-service organization signup (creates org + first ORG_ADMIN, immediate login).
   *
   * THE MINIMAL SET IS SIX FIELDS, matching registerOrganizationSchema server-side:
   * organizationName, countryCode, firstName, lastName, email, password.
   *
   * `registrationNumber` and `type` are NO LONGER SENT. They are KYB data — the registration
   * number is literally the input to AML screening — and they are collected at KYB submission
   * instead, where the certificate that proves them is uploaded. The backend still ACCEPTS them
   * (optional) for backward compatibility, and `kyb.service.submitOrgKyb` refuses a submission
   * while the registration number is still null, so nothing is lost by deferring them.
   *
   * `countryCode` IS now sent, and that is the point of this change. It was never sent before,
   * so the backend's `.default('KE')` made every self-signup organization Kenyan: a Ghanaian
   * partner got KES pricing, Kenyan sum-insured bounds and the Kenya/IRA KYB checklist with no
   * way to correct it. It picks the currency, the premium bounds, the payment provider and the
   * KYB required-document set, so it is the one signup field with irreversible consequence.
   *
   * `country` (the free-text column) is deliberately NOT a parameter: the backend declares it
   * `Joi.forbidden()` and derives it from `countryCode`, because a row whose country name and
   * country code disagree is a row every market gate reads differently.
   */
  async registerOrganization(data: {
    organizationName: string;
    countryCode: string;
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
      signal: timeoutSignal(REFRESH_TIMEOUT_MS),
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

  /**
   * Platform-admin organization creation.
   *
   * `countryCode` is the market key. It was not a parameter here AND not in the backend's
   * `registerOrgSchema`, which runs with stripUnknown — so there was no way for a platform admin
   * to create an organization in any market but Kenya, and nothing reported the omission.
   *
   * `country` (the free-text column) is deliberately NOT a parameter: the backend forbids it and
   * derives it from `countryCode`, so a row's country name and country code cannot disagree.
   */
  async platformRegisterOrganization(data: {
    name: string;
    registrationNumber?: string;
    type: string;
    countryCode: string;
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
  // WEATHER STATIONS (WeatherXM Pro, proxied by the backend so the key stays server-side)
  // ============================================

  async weatherStationMarkets() {
    return this.request<WeatherMarket[]>('/dashboard/platform/weather-stations/markets');
  }

  async weatherStationsInMarket(country: string) {
    return this.request<WeatherStationCoverage>(
      `/dashboard/platform/weather-stations?country=${encodeURIComponent(country)}`,
    );
  }

  async plotWeatherCoverage(plotId: string, radiusKm?: number) {
    const query = radiusKm ? `?radiusKm=${radiusKm}` : '';
    return this.request<PlotCoverage>(
      `/dashboard/org/plots/${encodeURIComponent(plotId)}/weather-stations${query}`,
    );
  }

  // ============================================
  // PLATFORM DASHBOARD
  // ============================================

  /**
   * The platform overview. Answers in the NESTED shape (organizations/policies/farmers/financials)
   * with money split per currency in `financials.byCurrency` and payouts in USDC — see
   * normalizePlatformStats in lib/platform-analytics, which is the only reader of this payload.
   */
  async platformDashboardOverview(params?: Omit<PlatformAnalyticsQuery, 'granularity'> & { period?: string }) {
    return this.request<unknown>(`/dashboard/platform/overview${toQuery(params)}`);
  }

  async platformDashboardOrganizations(params?: {
    period?: string;
    page?: number;
    limit?: number;
    type?: string;
    isActive?: boolean;
    search?: string;
  }) {
    return this.requestWithPagination<Organization[]>(`/dashboard/platform/organizations${toQuery(params)}`);
  }

  async platformDashboardOrgMetrics(orgId: string, params?: { period?: string }) {
    return this.request<OrganizationStats>(`/dashboard/platform/organizations/${encodeURIComponent(orgId)}/metrics${toQuery(params)}`);
  }

  // The analytics responses are typed `unknown` on purpose: the platform pages render the view
  // models built by lib/platform-analytics, never the wire shape, because the wire shape is
  // exactly what the old pages got wrong. `countryCode`, `startDate`/`endDate` and `granularity`
  // are all honoured server-side and all sent; nothing is dropped on the way out.

  async platformAnalyticsRevenue(params?: PlatformAnalyticsQuery) {
    return this.request<unknown>(`/dashboard/platform/analytics/revenue${toQuery(params)}`);
  }

  async platformAnalyticsPolicies(params?: PlatformAnalyticsQuery) {
    return this.request<unknown>(`/dashboard/platform/analytics/policies${toQuery(params)}`);
  }

  async platformAnalyticsFarmers(params?: PlatformAnalyticsQuery) {
    return this.request<unknown>(`/dashboard/platform/analytics/farmers${toQuery(params)}`);
  }

  async platformAnalyticsPayouts(params?: PlatformAnalyticsQuery) {
    return this.request<unknown>(`/dashboard/platform/analytics/payouts${toQuery(params)}`);
  }

  async platformAnalyticsDamage(params?: Omit<PlatformAnalyticsQuery, 'granularity'> & { period?: string; page?: number; limit?: number }) {
    return this.request<unknown>(`/dashboard/platform/analytics/damage-assessments${toQuery(params)}`);
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

  /**
   * The organization's OWN effective capability map — every capability the backend knows, with
   * the effective answer computed by the same predicate the server's gates use.
   *
   * Reachable by every org role, deliberately: a Viewer who could not see which surfaces its
   * organization has would be shown the dead controls this read exists to remove. The response
   * carries no operator reason and no admin identity — that is the platform-admin read below.
   */
  async getMyCapabilities() {
    return this.request<{ capabilities: OrgCapabilityStatus[] }>('/organizations/me/capabilities');
  }

  // ---- Platform-admin capability toggles -------------------------------------------
  // Unlike the org-facing read above, these carry the operator reason, the admin who set it and
  // the append-only change history.

  async platformGetOrgCapabilities(orgId: string) {
    return this.request<OrgCapabilitiesResponse>(
      `/platform/organizations/${encodeURIComponent(orgId)}/capabilities`,
    );
  }

  /**
   * One organization's policies, for a platform admin. NOT getPolicies: that is the org-scoped
   * GET /policies, which resolves the org from the caller. A platform admin has none, so it was
   * refused, and on older backends the refusal was a 401 that signed the admin out.
   */
  async platformGetOrgPolicies(orgId: string, params?: { page?: number; limit?: number; status?: string }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<Policy[]>(
      `/platform/organizations/${encodeURIComponent(orgId)}/policies${query ? `?${query}` : ''}`,
    );
  }

  /** One organization's payouts, for a platform admin. See platformGetOrgPolicies. */
  async platformGetOrgPayouts(orgId: string, params?: { page?: number; limit?: number; status?: string }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<Payout[]>(
      `/platform/organizations/${encodeURIComponent(orgId)}/payouts${query ? `?${query}` : ''}`,
    );
  }

  /**
   * Flip one capability. The reason is MANDATORY and must be at least 10 characters — the
   * backend refuses a shorter one, in the validator and again in the service, because the audit
   * row is only useful if it says why.
   */
  async platformSetOrgCapability(
    orgId: string,
    capability: OrgCapability,
    enabled: boolean,
    reason: string,
  ) {
    return this.request<SetOrgCapabilityResult>(
      `/platform/organizations/${encodeURIComponent(orgId)}/capabilities/${encodeURIComponent(capability)}`,
      { method: 'PUT', body: JSON.stringify({ enabled, reason }) },
    );
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

  // Org-facing reserve custody (getReserve / depositReserve / withdrawReserve) was
  // retired with the non-custodial (collateralized-trust) model: an insurer's reserve
  // now sits off-platform in a segregated trust, not in a platform-provisioned wallet.
  // Platform-admin reserve reads/ratio remain (getOrgReserve / setReserveRatio) as
  // operators of the on-chain reserve-draw path, which is flagged for rework.

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

  // The per-org custody wallet (getOrgWallet / fundWallet via M-Pesa) was retired with
  // the non-custodial model. MicroCrop does not hold an insurer's capital; there is no
  // platform-provisioned wallet for an org to top up.

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
  // PRODUCT CATALOGUE
  // ============================================

  /**
   * What each market lists, and with which status. An organization user receives only its own
   * market; a platform admin receives every market. Reachable by every role.
   */
  async getCatalogue() { return this.request<CatalogueResponse>('/catalogue'); }

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
    return this.request<BulkImportResult & {
      consent?: Record<string, unknown>;
      kyc?: { approved: number; pending: number };
    }>('/farmers/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ farmers }),
    });
  }

  // ============================================
  // FARMER CONSENT (Kenya Data Protection Act 2019)
  //
  // Reads need `farmer:read`, capture and withdrawal need `farmer:update` — the field
  // agent standing in front of the farmer is the point of capture, so this is
  // deliberately not an admin-only namespace.
  // ============================================

  /**
   * The versioned document registry. Every document is a PLACEHOLDER today: `body` is
   * null and the version string carries `UNAPPROVED-PLACEHOLDER`. The response's own
   * `warning` is the only wording the UI may show about that — do not write copy here.
   */
  async getConsentDocuments() {
    return this.request<ConsentDocumentsResponse>('/farmers/consent/documents');
  }

  async getFarmerConsent(farmerId: string) {
    return this.request<FarmerConsentStatus>(
      `/farmers/${encodeURIComponent(farmerId)}/consent`,
    );
  }

  /**
   * Record consent to the CURRENT version of a document. The version is never sent:
   * the server reads it from the registry at capture time, so a client cannot claim
   * consent to a version that was never published.
   */
  async recordFarmerConsent(farmerId: string, data: {
    documentId: string;
    method: ConsentMethod;
    evidenceRef?: string;
    locale?: string;
  }) {
    return this.request<RecordConsentResponse>(
      `/farmers/${encodeURIComponent(farmerId)}/consent`,
      { method: 'POST', body: JSON.stringify(data) },
    );
  }

  /** Withdraw the standing grant. Append-only: the row survives, stamped `revokedAt`. */
  async withdrawFarmerConsent(farmerId: string, data: {
    documentId: string;
    reason?: string;
  }) {
    return this.request<WithdrawConsentResponse>(
      `/farmers/${encodeURIComponent(farmerId)}/consent/withdraw`,
      { method: 'POST', body: JSON.stringify(data) },
    );
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
    return this.request<BulkImportResult>('/farmers/bulk-import/plots', {
      method: 'POST',
      body: JSON.stringify({ plots }),
    });
  }

  /**
   * Herd import — the file alternative to livestock onboarding. Requires BULK_IMPORT and
   * LIVESTOCK_UNDERWRITING, and a market that lists livestock (Ghana is refused whole-batch with
   * PRODUCT_NOT_IN_MARKET).
   */
  async bulkImportHerds(herds: Record<string, unknown>[]) {
    return this.request<BulkImportResult>('/farmers/bulk-import/herds', {
      method: 'POST',
      body: JSON.stringify({ herds }),
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
    // The endpoint returns { policy, paymentInstructions } inside the standard
    // envelope; `request` only strips the envelope, so the type parameter must
    // describe both halves or callers silently lose the premium amount.
    return this.request<PolicyPurchaseResponse>('/policies/purchase', {
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
  // DETERMINATIONS (the Tier 1 product)
  //
  // Org-scoped, permission `determination:read`. NOT tier-gated, deliberately: both tiers
  // determine, and the tier only decides who SETTLES. Gating these reads on the settlement tier
  // would hide the Determination plan's one deliverable from the partners who bought it.
  //
  // The security boundary is a relation filter inside the server's WHERE clause, so another
  // org's determination id returns 404 — identical to an unknown id, on purpose.
  // ============================================

  async getDeterminations(params?: {
    page?: number;
    limit?: number;
    status?: DeterminationStatus;
    kind?: string;
    policyId?: string;
  }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.requestWithPagination<PartnerDetermination[]>(
      `/determinations${query ? `?${query}` : ''}`
    );
  }

  async getDetermination(determinationId: string) {
    return this.request<PartnerDetermination>(
      `/determinations/${encodeURIComponent(determinationId)}`
    );
  }

  /**
   * The evidence package: the canonical signed body, its hash, the signer, the provenance
   * citation and the notary anchor. This is the artifact a Tier 1 partner actually bought, and
   * it is independently verifiable without MicroCrop — so it is fetched as JSON and saved
   * byte-for-byte, never rebuilt from rendered fields.
   */
  async getDeterminationEvidence(determinationId: string) {
    return this.request<EvidencePackage>(
      `/determinations/${encodeURIComponent(determinationId)}/evidence`
    );
  }

  /**
   * Record what YOUR organization paid the farmer off-platform.
   *
   * Writes no Payout, no Transaction and no policy status — MicroCrop moves no money here and
   * stores the statement labelled partner-attested and unverified.
   *
   * IDEMPOTENT on (determinationId, `partnerReference`). `partnerReference` is a BODY field and
   * is the partner's own settlement reference (M-Pesa code, bank reference), NOT a per-attempt
   * uuid: re-posting the same reference returns the stored row with `replayed: true` instead of
   * recording a second attestation that the same money moved once. A caller that generated a
   * fresh key per retry would defeat the guarantee, so never synthesise this value.
   *
   * `settledAmountMinor` must be a canonical decimal STRING of minor units — see
   * `@/lib/money-minor`. Sending a number, or any USDC-named field, is a 400 by design.
   */
  async recordSettlementReport(determinationId: string, body: SettlementReportInput) {
    return this.request<SettlementReportResult>(
      `/determinations/${encodeURIComponent(determinationId)}/settlement-report`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  /** The full correction chain, newest first, superseded rows included. */
  async getSettlementReports(determinationId: string) {
    return this.request<SettlementReportsResponse>(
      `/determinations/${encodeURIComponent(determinationId)}/settlement-report`
    );
  }

  // ============================================
  // STAFF MANAGEMENT
  // ============================================

  async getStaff() {
    return this.request<User[]>('/staff');
  }

  async getMyPermissions() {
    return this.request<import('@/types').MyPermissions>('/staff/me/permissions');
  }

  async inviteStaff(data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: OrgRole;
  }) {
    return this.request<User & { inviteUrl: string }>('/staff/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendStaffInvite(userId: string) {
    return this.request<User & { inviteUrl: string }>(`/staff/${encodeURIComponent(userId)}/resend-invite`, {
      method: 'POST',
    });
  }

  async getStaffInvitation(token: string) {
    return this.request<{ email: string; firstName: string; lastName: string; organizationName: string | null }>(
      `/staff/invitation/${encodeURIComponent(token)}`,
    );
  }

  async acceptStaffInvitation(token: string, password: string) {
    return this.request<User>('/staff/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async updateStaffRole(userId: string, role: OrgRole) {
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

  async deleteStaff(userId: string) {
    return this.request<{ id: string; removed: boolean }>(`/staff/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
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
    const { response, logoutOn401 } = await this.send(endpoint, {}, {});

    if (!response.ok) {
      if (response.status === 401 && logoutOn401) {
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

  /**
   * Triggers the M-Pesa STK push for a PENDING policy's premium.
   *
   * The backend reads `reference` (the policy id) and `amount` — it rejects the
   * request outright when `amount` is missing, so `amount` is required here and
   * `policyId` is mapped onto `reference` at the boundary rather than by callers.
   * Pass `paymentInstructions.amount` from `purchasePolicy`.
   */
  async initiatePayment(data: { policyId: string; amount: number; phoneNumber: string }) {
    return this.request<PaymentInitiateResponse>('/payments/initiate', {
      method: 'POST',
      body: JSON.stringify({
        reference: data.policyId,
        amount: data.amount,
        phoneNumber: data.phoneNumber,
      }),
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
