/**
 * API Service Layer
 *
 * Thin wrapper over apiClient that normalizes backend responses
 * to the shapes the frontend components expect.
 */

import { apiClient } from './client';
import type {
  User,
  Organization,
  OrganizationType,
  OrgAdminInvitation,
  OnboardingStep,
  ReserveStatus,
  TreasuryStats,
  OrgWallet,
  WalletFundResult,
  Farmer,
  Plot,
  Policy,
  PolicyQuote,
  PolicyStatus,
  CoverageType,
  Payout,
  GpsPoint,
  GpsTrackResponse,
  KycFieldVerifyResponse,
  PaymentInitiateResponse,
  PaymentStatusResponse,
  PlotBoundary,
  Activity,
  BlogPost,
  BlogCategory,
  BlogTag,
  PostStatus,
  UploadResult,
} from '@/types';

const toArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested = record.data ?? record.items ?? record.results ?? record.plots;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const api = {
  // ============================================
  // AUTH
  // ============================================

  login: async (email: string, password: string) => {
    const result = await apiClient.login(email, password);
    return {
      user: {
        ...result.user,
        isActive: true,
        createdAt: new Date().toISOString(),
      } as User,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: Date.now() + 3600000, // 1 hour
      },
    };
  },

  registerOrganization: async (data: {
    organizationName: string;
    registrationNumber: string;
    type: string;
    county?: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    const result = await apiClient.registerOrganization(data);
    return {
      user: {
        ...result.user,
        isActive: true,
        createdAt: new Date().toISOString(),
      } as User,
      organization: result.organization,
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: Date.now() + 3600000,
      },
    };
  },

  getMe: async () => {
    return apiClient.getMe();
  },

  // ---- Org KYB (in-dashboard) ----
  getMyKyb: async () => {
    return apiClient.getMyKyb();
  },

  submitMyKyb: async (formData: FormData) => {
    return apiClient.submitMyKyb(formData);
  },

  // ---- Platform KYB review ----
  getKybReviews: async () => {
    return apiClient.getKybReviews();
  },

  getOrgKyb: async (orgId: string) => {
    return apiClient.getOrgKyb(orgId);
  },

  reviewOrgKyb: async (orgId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) => {
    return apiClient.reviewOrgKyb(orgId, decision, notes);
  },

  refreshToken: async (refreshToken: string) => {
    return apiClient.refreshToken(refreshToken);
  },

  forgotPassword: async (email: string) => {
    return apiClient.forgotPassword(email);
  },

  resetPassword: async (token: string, password: string) => {
    return apiClient.resetPassword(token, password);
  },

  // ============================================
  // PLATFORM STATS
  // ============================================

  getPlatformStats: async () => {
    return apiClient.platformDashboardOverview();
  },

  // ============================================
  // ORGANIZATIONS
  // ============================================

  getOrganizations: async () => {
    const result = await apiClient.platformDashboardOrganizations();
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getOrganization: async (id: string) => {
    return apiClient.platformGetOrganization(id);
  },

  getOrganizationStats: async (id: string) => {
    return apiClient.platformDashboardOrgMetrics(id);
  },

  getOrgDashboardStats: async () => {
    return apiClient.orgDashboardOverview();
  },

  adminCreateOrganization: async (data: {
    name: string;
    registrationNumber: string;
    type: OrganizationType;
    contactFirstName: string;
    contactLastName: string;
    contactEmail: string;
    contactPhone: string;
    verifyImmediately?: boolean;
    brandName?: string;
    county?: string;
  }) => {
    const result = await apiClient.platformRegisterOrganization({
      name: data.name,
      registrationNumber: data.registrationNumber,
      type: data.type,
      contactPerson: `${data.contactFirstName} ${data.contactLastName}`,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      brandName: data.brandName,
      county: data.county,
    });
    return result.organization;
  },

  // ============================================
  // INVITATIONS
  // ============================================

  createOrgAdminInvitation: async (data: {
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
  }) => {
    return apiClient.createInvitation(data);
  },

  sendOrgAdminInvitation: async (invitationId: string) => {
    return apiClient.sendInvitation(invitationId);
  },

  getOrgInvitations: async (organizationId?: string) => {
    const result = await apiClient.getInvitations({ organizationId });
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getInvitation: async (_id: string) => {
    // Real API doesn't have single invitation endpoint yet
    throw new Error('Not implemented');
  },

  validateInvitationToken: async (token: string) => {
    const result = await apiClient.validateInvitationToken(token);
    // Backend may return the invitation directly or wrapped in { valid, invitation }
    if (result && !('valid' in result)) {
      return { valid: true, invitation: result as unknown as OrgAdminInvitation };
    }
    return result;
  },

  acceptInvitation: async (token: string, password: string) => {
    return apiClient.acceptInvitation(token, password);
  },

  // ============================================
  // FARMERS
  // ============================================

  getFarmers: async (_orgId: string, params?: { kycStatus?: string; search?: string }) => {
    const result = await apiClient.getFarmers(params);
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getFarmer: async (id: string) => {
    return apiClient.getFarmer(id);
  },

  // ============================================
  // PLOTS
  // ============================================

  getPlots: async (_orgId: string) => {
    const result = await apiClient.orgDashboardPlots();
    const plots = toArray<Plot>(result.data);
    return { data: plots, total: result.pagination?.total || plots.length };
  },

  // ============================================
  // POLICIES
  // ============================================

  getPolicies: async (_orgId: string) => {
    const result = await apiClient.getPolicies();
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getPolicy: async (id: string) => {
    return apiClient.getPolicy(id);
  },

  // ============================================
  // PAYOUTS
  // ============================================

  getPayouts: async (_orgId: string) => {
    const result = await apiClient.getPayouts();
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  // ============================================
  // DAMAGE ASSESSMENTS
  // ============================================

  getDamageAssessments: async () => {
    const result = await apiClient.orgDashboardDamageAssessments();
    return { data: result.assessments, total: result.totalCount };
  },

  // ============================================
  // ACTIVITIES
  // ============================================

  getActivities: async (orgId?: string) => {
    const result = orgId
      ? await apiClient.orgDashboardActivity()
      : await apiClient.platformActivity();

    const raw = Array.isArray(result)
      ? result
      : (result as { activity?: unknown; activities?: unknown }).activity
        ?? (result as { activities?: unknown }).activities;

    const rawList: unknown[] = Array.isArray(raw) ? raw : [];

    // Backend field names have drifted (`description` vs `message`,
    // `created_at`/`timestamp` vs `createdAt`). Map known variants.
    const humanizeType = (t: string): string =>
      t.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

    const activities = rawList.map((item, idx) => {
      const r = (item ?? {}) as Record<string, unknown>;
      const pickString = (...keys: string[]): string | undefined => {
        for (const k of keys) {
          const v = r[k];
          if (typeof v === 'string' && v.length > 0) return v;
        }
        return undefined;
      };
      // Look for a message string nested under common wrappers too.
      const pickNested = (parents: string[], keys: string[]): string | undefined => {
        for (const p of parents) {
          const parent = r[p];
          if (parent && typeof parent === 'object') {
            const child = parent as Record<string, unknown>;
            for (const k of keys) {
              const v = child[k];
              if (typeof v === 'string' && v.length > 0) return v;
            }
          }
        }
        return undefined;
      };

      const type = (pickString('type', 'eventType', 'kind', 'action') ?? 'UNKNOWN') as Activity['type'];
      const directMsg = pickString(
        'message',
        'description',
        'text',
        'summary',
        'details',
        'title',
        'displayMessage',
        'humanReadable',
      );
      const nestedMsg = pickNested(
        ['metadata', 'data', 'payload', 'event'],
        ['message', 'description', 'text', 'summary', 'details'],
      );

      return {
        id: pickString('id', '_id', 'activityId', 'eventId') ?? `activity-${idx}`,
        type,
        message: directMsg ?? nestedMsg ?? humanizeType(String(type)),
        organizationId: pickString('organizationId', 'orgId', 'organization_id'),
        userId: pickString('userId', 'user_id', 'actorId'),
        createdAt:
          pickString('createdAt', 'created_at', 'timestamp', 'occurredAt', 'time', 'date') ?? '',
        metadata: (typeof r.metadata === 'object' && r.metadata !== null
          ? (r.metadata as Record<string, unknown>)
          : undefined),
      } as Activity;
    });

    return { data: activities, total: activities.length };
  },

  // ============================================
  // ORGANIZATION RESERVE (per-org treasury / v3)
  // ============================================

  getReserve: async (): Promise<ReserveStatus> => {
    return apiClient.getReserve();
  },

  depositReserve: async (data: { amountUsdc: number }): Promise<{ txHash: string; amountUsdc: number }> => {
    return apiClient.depositReserve(data);
  },

  withdrawReserve: async (data: { amountUsdc: number; to?: string }): Promise<{ txHash: string; amountUsdc: number; to: string }> => {
    return apiClient.withdrawReserve(data);
  },

  // ============================================
  // ORGANIZATION WALLET
  // ============================================

  getOrgWallet: async (): Promise<OrgWallet> => {
    return apiClient.getOrgWallet();
  },

  fundWallet: async (data: { phoneNumber: string; amountKES: number }): Promise<WalletFundResult> => {
    // Convert local phone format (07...) to international (+254...)
    // while guarding against non-string runtime values.
    const rawPhone = typeof data.phoneNumber === 'string'
      ? data.phoneNumber.trim()
      : String(data.phoneNumber ?? '').trim();
    const phoneNumber = rawPhone.startsWith('0')
      ? `+254${rawPhone.slice(1)}`
      : rawPhone;
    return apiClient.fundWallet({ ...data, phoneNumber });
  },

  // ============================================
  // ORGANIZATION WEBHOOKS (partner integration)
  // ============================================

  getWebhookConfig: async () => {
    return apiClient.getWebhookConfig();
  },

  setWebhookConfig: async (url: string) => {
    return apiClient.setWebhookConfig(url);
  },

  rotateWebhookSecret: async () => {
    return apiClient.rotateWebhookSecret();
  },

  getWebhookDeliveries: async (params?: Parameters<typeof apiClient.getWebhookDeliveries>[0]) => {
    return apiClient.getWebhookDeliveries(params);
  },

  retryWebhookDelivery: async (id: string) => {
    return apiClient.retryWebhookDelivery(id);
  },

  // ============================================
  // ORGANIZATION API KEY (rotate-only)
  // ============================================

  getApiKey: async () => {
    return apiClient.getApiKey();
  },

  rotateApiKey: async () => {
    return apiClient.rotateApiKey();
  },

  revokeApiKey: async () => {
    return apiClient.revokeApiKey();
  },

  // ============================================
  // PLATFORM — PER-ORG TREASURY (v3)
  // ============================================

  platformProvisionWallet: async (orgId: string): Promise<{ walletAddress: string; privyWalletId: string; alreadyProvisioned: boolean }> => {
    return apiClient.platformProvisionWallet(orgId);
  },

  platformSetReserveRatio: async (orgId: string, ratioBps: number): Promise<{ orgId: string; walletAddress: string; ratioBps: number; txHash: string }> => {
    return apiClient.platformSetReserveRatio(orgId, ratioBps);
  },

  // ============================================
  // TREASURY
  // ============================================

  getTreasuryStats: async (): Promise<TreasuryStats> => {
    const result = await apiClient.platformGetTreasury();
    return {
      balance: parseFloat(result.balance),
      totalPremiums: parseFloat(result.totalPremiums),
      totalPayouts: parseFloat(result.totalPayouts),
      accumulatedFees: parseFloat(result.accumulatedFees),
      platformFeePercent: result.platformFeePercent,
      reserveRatio: result.reserveRatio,
      requiredReserve: parseFloat(result.requiredReserve),
      availableForPayouts: parseFloat(result.availableForPayouts),
      meetsReserve: result.meetsReserve,
      paused: result.paused,
    };
  },

  // ============================================
  // ANALYTICS
  // ============================================

  getRevenueAnalytics: async () => {
    return apiClient.platformAnalyticsRevenue();
  },

  getPoliciesAnalytics: async () => {
    return apiClient.platformAnalyticsPolicies();
  },

  getFarmersAnalytics: async () => {
    return apiClient.platformAnalyticsFarmers();
  },

  getPayoutsAnalytics: async () => {
    return apiClient.platformAnalyticsPayouts();
  },

  getDamageAnalytics: async () => {
    return apiClient.platformAnalyticsDamage();
  },

  getFinancialSummary: async () => {
    return apiClient.orgDashboardFinancials();
  },

  // ============================================
  // STAFF
  // ============================================

  getStaff: async () => {
    return apiClient.getStaff();
  },

  inviteStaff: async (data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: 'ORG_ADMIN' | 'ORG_STAFF';
  }) => {
    return apiClient.inviteStaff(data);
  },

  updateStaffRole: async (userId: string, role: 'ORG_ADMIN' | 'ORG_STAFF') => {
    return apiClient.updateStaffRole(userId, role);
  },

  deactivateStaff: async (userId: string) => {
    return apiClient.deactivateStaff(userId);
  },

  reactivateStaff: async (userId: string) => {
    return apiClient.reactivateStaff(userId);
  },

  // ============================================
  // AUTH (additional)
  // ============================================

  register: async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => {
    return apiClient.register(data);
  },

  // ============================================
  // PLATFORM ADMIN ACTIONS
  // ============================================

  configureOrganization: async (orgId: string, config: {
    ussdShortCode?: string;
    brandName?: string;
    brandColor?: string;
    logoUrl?: string;
    webhookUrl?: string;
  }) => {
    return apiClient.platformConfigureOrganization(orgId, config);
  },

  activateOrganization: async (orgId: string) => {
    return apiClient.platformActivateOrganization(orgId);
  },

  deactivateOrganization: async (orgId: string) => {
    return apiClient.platformDeactivateOrganization(orgId);
  },

  getOnboardingStatus: async (orgId: string): Promise<{ step: OnboardingStep; completedSteps: OnboardingStep[] }> => {
    return apiClient.platformGetOnboardingStatus(orgId);
  },

  // ============================================
  // ORG SELF-SERVICE
  // ============================================

  getMyOrganization: async () => {
    return apiClient.getMyOrganization();
  },

  getMyOrgStats: async () => {
    return apiClient.getMyOrganizationStats();
  },

  updateOrgSettings: async (settings: {
    brandColor?: string;
    webhookUrl?: string;
    contactPhone?: string;
  }) => {
    return apiClient.updateOrganizationSettings(settings);
  },

  // ============================================
  // FARMER OPERATIONS
  // ============================================

  registerFarmer: async (data: {
    phoneNumber: string;
    nationalId: string;
    firstName: string;
    lastName: string;
    county: string;
    subCounty?: string;
    ward?: string;
    village?: string;
  }): Promise<Farmer> => {
    const trimOrUndefined = (value?: string) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    };

    return apiClient.registerFarmer({
      phoneNumber: data.phoneNumber.trim(),
      nationalId: data.nationalId.trim(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      county: data.county.trim(),
      subCounty: trimOrUndefined(data.subCounty),
      ward: trimOrUndefined(data.ward),
      village: trimOrUndefined(data.village),
    });
  },

  updateFarmer: async (farmerId: string, data: {
    phoneNumber?: string;
    ward?: string;
    village?: string;
  }): Promise<Farmer> => {
    return apiClient.updateFarmer(farmerId, data);
  },

  updateFarmerKyc: async (farmerId: string, data: {
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
  }): Promise<Farmer> => {
    return apiClient.updateFarmerKyc(farmerId, data);
  },

  bulkImportFarmers: async (farmers: Record<string, unknown>[]) => {
    return apiClient.bulkImportFarmers(farmers);
  },

  bulkImportPlots: async (plots: Record<string, unknown>[]) => {
    return apiClient.bulkImportPlots(plots);
  },

  // ============================================
  // PLOTS (CRUD)
  // ============================================

  createPlot: async (farmerId: string, data: {
    name: string;
    latitude: number;
    longitude: number;
    acreage: number;
    cropType: string;
    plantingDate?: string;
  }): Promise<Plot> => {
    return apiClient.createPlot(farmerId, data);
  },

  getPlot: async (plotId: string): Promise<Plot> => {
    return apiClient.getPlot(plotId);
  },

  updatePlot: async (plotId: string, data: {
    name?: string;
    latitude?: number;
    longitude?: number;
    acreage?: number;
    cropType?: string;
  }): Promise<Plot> => {
    return apiClient.updatePlot(plotId, data);
  },

  // ============================================
  // POLICY LIFECYCLE
  // ============================================

  getPolicyQuote: async (data: {
    farmerId: string;
    productType?: 'CROP' | 'LIVESTOCK';
    plotId?: string;
    herdId?: string;
    sumInsured: number;
    coverageType: CoverageType;
    durationDays: number;
    season?: 'LRLD' | 'SRSD';
  }): Promise<PolicyQuote> => {
    return apiClient.getPolicyQuote(data);
  },

  purchasePolicy: async (data: {
    farmerId: string;
    productType?: 'CROP' | 'LIVESTOCK';
    plotId?: string;
    herdId?: string;
    sumInsured: number;
    coverageType: CoverageType;
    durationDays: number;
    season?: 'LRLD' | 'SRSD';
  }): Promise<Policy> => {
    return apiClient.purchasePolicy(data);
  },

  getPolicyStatus: async (policyId: string): Promise<{ status: PolicyStatus }> => {
    return apiClient.getPolicyStatus(policyId);
  },

  activatePolicy: async (policyId: string): Promise<Policy> => {
    return apiClient.activatePolicy(policyId);
  },

  cancelPolicy: async (policyId: string, reason: string): Promise<Policy> => {
    return apiClient.cancelPolicy(policyId, reason);
  },

  // ============================================
  // PAYOUT OPERATIONS
  // ============================================

  getPayout: async (payoutId: string): Promise<Payout> => {
    return apiClient.getPayout(payoutId);
  },

  retryPayout: async (payoutId: string): Promise<Payout> => {
    return apiClient.retryPayout(payoutId);
  },

  batchRetryPayouts: async (payoutIds?: string[], retryAllFailed?: boolean) => {
    return apiClient.batchRetryPayouts(payoutIds, retryAllFailed);
  },

  getPayoutReconciliation: async (params?: { startDate?: string; endDate?: string }) => {
    return apiClient.getPayoutReconciliation(params);
  },

  // ============================================
  // TREASURY (additional)
  // ============================================

  getTreasuryBalance: async () => {
    return apiClient.platformGetTreasuryBalance();
  },

  // ============================================
  // EXPORTS
  // ============================================

  exportFarmers: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    return apiClient.exportFarmers(params);
  },

  exportPolicies: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    return apiClient.exportPolicies(params);
  },

  exportPayouts: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    return apiClient.exportPayouts(params);
  },

  exportTransactions: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    return apiClient.exportTransactions(params);
  },

  exportPlatformOrganizations: async (params?: { period?: string }): Promise<Blob> => {
    return apiClient.exportPlatformOrganizations(params);
  },

  exportPlatformRevenue: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    return apiClient.exportPlatformRevenue(params);
  },

  // ============================================
  // FIELD ONBOARDING
  // ============================================

  fieldVerifyKyc: async (farmerId: string): Promise<KycFieldVerifyResponse> => {
    return apiClient.fieldVerifyKyc(farmerId);
  },

  submitGpsTrack: async (plotId: string, data: {
    points: GpsPoint[];
    accuracyThreshold?: number;
  }): Promise<GpsTrackResponse> => {
    return apiClient.submitGpsTrack(plotId, data);
  },

  getPlotBoundaryReview: async (plotId: string): Promise<PlotBoundary> => {
    return apiClient.getPlotBoundaryReview(plotId);
  },

  initiatePayment: async (data: { policyId: string; phoneNumber: string }): Promise<PaymentInitiateResponse> => {
    return apiClient.initiatePayment(data);
  },

  getPaymentStatusByRef: async (reference: string): Promise<PaymentStatusResponse> => {
    return apiClient.getPaymentStatusByRef(reference);
  },

  // ============================================
  // PROFILE
  // ============================================

  updateMyProfile: async (data: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    displayRole?: string | null;
  }): Promise<User> => {
    return apiClient.updateMyProfile(data);
  },

  // ============================================
  // BLOG
  // ============================================

  uploadBlogImage: async (file: File): Promise<UploadResult> => {
    return apiClient.uploadBlogImage(file);
  },

  getBlogPosts: async (params?: {
    page?: number;
    pageSize?: number;
    status?: PostStatus;
    categoryId?: string;
    search?: string;
  }) => {
    const result = await apiClient.getBlogPosts(params);
    return {
      data: toArray<BlogPost>(result.data),
      total: result.pagination?.total || toArray<BlogPost>(result.data).length,
      page: result.pagination?.page,
      totalPages: result.pagination?.totalPages,
    };
  },

  getBlogPost: async (id: string): Promise<BlogPost> => {
    return apiClient.getBlogPost(id);
  },

  createBlogPost: async (data: {
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
  }): Promise<BlogPost> => {
    return apiClient.createBlogPost(data);
  },

  updateBlogPost: async (id: string, data: Parameters<typeof apiClient.updateBlogPost>[1]): Promise<BlogPost> => {
    return apiClient.updateBlogPost(id, data);
  },

  deleteBlogPost: async (id: string) => {
    return apiClient.deleteBlogPost(id);
  },

  publishBlogPost: async (id: string, scheduledFor?: string): Promise<BlogPost> => {
    return apiClient.publishBlogPost(id, scheduledFor);
  },

  unpublishBlogPost: async (id: string): Promise<BlogPost> => {
    return apiClient.unpublishBlogPost(id);
  },

  getBlogCategories: async (): Promise<BlogCategory[]> => {
    const result = await apiClient.getBlogCategories();
    return toArray<BlogCategory>(result);
  },

  createBlogCategory: async (data: { name: string; slug?: string; description?: string }): Promise<BlogCategory> => {
    return apiClient.createBlogCategory(data);
  },

  updateBlogCategory: async (id: string, data: { name?: string; slug?: string; description?: string }): Promise<BlogCategory> => {
    return apiClient.updateBlogCategory(id, data);
  },

  deleteBlogCategory: async (id: string) => {
    return apiClient.deleteBlogCategory(id);
  },

  getBlogTags: async (): Promise<BlogTag[]> => {
    const result = await apiClient.getBlogTags();
    return toArray<BlogTag>(result);
  },

  createBlogTag: async (data: { name: string; slug?: string }): Promise<BlogTag> => {
    return apiClient.createBlogTag(data);
  },

  deleteBlogTag: async (id: string) => {
    return apiClient.deleteBlogTag(id);
  },

  // ============================================
  // HERDS (Organization specific)
  // ============================================

  getHerds: async (params?: Parameters<typeof apiClient.getHerds>[0]) => {
    const result = await apiClient.getHerds(params);
    return { data: toArray<import('@/types').Herd>(result), pagination: result.pagination };
  },

  getHerd: async (herdId: string) => {
    return apiClient.getHerd(herdId);
  },

  createHerd: async (data: Parameters<typeof apiClient.createHerd>[0]) => {
    return apiClient.createHerd(data);
  },

  // ============================================
  // INSURANCE UNITS (Platform Admin)
  // ============================================

  getInsuranceUnits: async (params?: Parameters<typeof apiClient.getInsuranceUnits>[0]) => {
    const result = await apiClient.getInsuranceUnits(params);
    return { data: toArray<import('@/types').InsuranceUnit>(result), pagination: result.pagination };
  },

  createInsuranceUnit: async (data: Parameters<typeof apiClient.createInsuranceUnit>[0]) => {
    return apiClient.createInsuranceUnit(data);
  },

  getInsuranceUnit: async (id: string) => {
    return apiClient.getInsuranceUnit(id);
  },

  updateInsuranceUnit: async (id: string, data: Parameters<typeof apiClient.updateInsuranceUnit>[1]) => {
    return apiClient.updateInsuranceUnit(id, data);
  },

  // ============================================
  // INSURANCE UNITS (Org - Read Only)
  // ============================================

  getActiveInsuranceUnits: async (country?: string) => {
    const result = await apiClient.getActiveInsuranceUnits(country);
    return { data: toArray<import('@/types').InsuranceUnit>(result), pagination: result.pagination };
  },

  // ============================================
  // FORAGE ALERTS (Org — livestock/IBLI feed)
  // ============================================

  getForageAlerts: async (params?: Parameters<typeof apiClient.getForageAlerts>[0]) => {
    const result = await apiClient.getForageAlerts(params);
    return { data: toArray<import('@/types').ForageAlert>(result), pagination: result.pagination };
  },

  // ============================================
  // PLATFORM — PER-ORG RESERVE READ (solvency)
  // ============================================

  getOrgReserve: async (orgId: string): Promise<ReserveStatus & { message?: string }> => {
    return apiClient.getOrgReserve(orgId);
  },
};
