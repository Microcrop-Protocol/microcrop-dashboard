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
  ApplicationStatus,
  OrganizationApplication,
  OrgAdminInvitation,
  OnboardingStep,
  PoolStatus,
  PoolDepositResult,
  PoolWithdrawResult,
  PoolSettings,
  PlatformPool,
  PoolCounts,
  TreasuryStats,
  TreasuryPremiumAmounts,
  TreasuryPayoutAmounts,
  DeployPoolRequest,
  DeployPoolResult,
  OrgWallet,
  WalletFundResult,
  Farmer,
  Plot,
  Policy,
  PolicyQuote,
  PolicyStatus,
  Payout,
  Payment,
  InvestorInfo,
  PolicyExpireCheck,
  GpsPoint,
  GpsTrackResponse,
  KycFieldVerifyResponse,
  PaymentInitiateResponse,
  PaymentStatusResponse,
  PlotBoundary,
} from '@/types';

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

  getMe: async () => {
    return apiClient.getMe();
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
  // KYB / APPLICATIONS
  // ============================================

  submitOrgApplication: async (data: {
    name: string;
    registrationNumber: string;
    type: OrganizationType;
    contactFirstName: string;
    contactLastName: string;
    contactEmail: string;
    contactPhone: string;
    county?: string;
    estimatedFarmers?: number;
    website?: string;
    description?: string;
    documents: { type: 'BUSINESS_REGISTRATION_CERT' | 'TAX_PIN_CERT'; fileName: string; fileSize: number; file?: File }[];
  }) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('registrationNumber', data.registrationNumber);
    formData.append('type', data.type);
    formData.append('contactFirstName', data.contactFirstName);
    formData.append('contactLastName', data.contactLastName);
    formData.append('contactEmail', data.contactEmail);
    formData.append('contactPhone', data.contactPhone);

    if (data.county) formData.append('county', data.county);
    if (data.estimatedFarmers) formData.append('estimatedFarmers', data.estimatedFarmers.toString());
    if (data.website) formData.append('website', data.website);
    if (data.description) formData.append('description', data.description);

    data.documents.forEach((doc) => {
      if (doc.file) {
        const fieldName = doc.type === 'BUSINESS_REGISTRATION_CERT'
          ? 'businessRegistrationCert'
          : 'taxPinCert';
        formData.append(fieldName, doc.file);
      }
    });

    return apiClient.submitOrgApplication(formData);
  },

  getOrgApplications: async (status?: ApplicationStatus) => {
    const result = await apiClient.getOrgApplications({ status });
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getOrgApplication: async (id: string) => {
    return apiClient.getOrgApplication(id);
  },

  verifyKYB: async (applicationId: string, verification: { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string }) => {
    return apiClient.verifyKybApplication(applicationId, {
      status: verification.status === 'APPROVED' ? 'VERIFIED' : 'REJECTED',
      reviewNotes: verification.reviewNotes,
    });
  },

  getPendingKYBCount: async () => {
    const result = await apiClient.getPendingKybCount();
    return result.count;
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
    return { data: result.data, total: result.pagination?.total || result.data.length };
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
    return { data: result, total: result.length };
  },

  // ============================================
  // POOL
  // ============================================

  getLiquidityPool: async () => {
    return apiClient.getOrganizationPool();
  },

  getPoolDetails: async (): Promise<PoolStatus> => {
    const pool = await apiClient.getOrganizationPoolDetails();
    return {
      poolAddress: pool.poolAddress,
      poolValue: pool.poolValue,
      totalSupply: pool.totalSupply,
      tokenPrice: pool.tokenPrice,
      totalPremiums: pool.totalPremiums,
      totalPayouts: pool.totalPayouts,
      activeExposure: pool.activeExposure,
      minDeposit: pool.minDeposit,
      maxDeposit: pool.maxDeposit,
      targetCapital: pool.targetCapital,
      maxCapital: pool.maxCapital,
      depositsOpen: pool.depositsOpen,
      withdrawalsOpen: pool.withdrawalsOpen,
      paused: pool.paused,
      utilizationRate: pool.utilizationRate,
    };
  },

  depositToPool: async (data: { amount: number; minTokensOut?: number }): Promise<PoolDepositResult> => {
    return apiClient.depositToPool(data);
  },

  withdrawFromPool: async (data: { tokenAmount: number; minUsdcOut?: number }): Promise<PoolWithdrawResult> => {
    return apiClient.withdrawFromPool(data);
  },

  updatePoolSettings: async (settings: Partial<PoolSettings>): Promise<PoolSettings> => {
    return apiClient.updatePoolSettings(settings);
  },

  deployOrgPool: async (data: {
    name?: string;
    symbol?: string;
    poolType: 'PRIVATE' | 'PUBLIC' | 'MUTUAL';
    coverageType: string;
    region: string;
    targetCapital: number;
    maxCapital?: number;
    minDeposit?: number;
    maxDeposit?: number;
    memberContribution?: number;
    poolOwner?: string;
  }) => {
    const coverageTypeMap: Record<string, number> = { DROUGHT: 0, FLOOD: 1, PEST: 2, DISEASE: 3, COMPREHENSIVE: 4 };
    return apiClient.deployOrgPool({
      ...data,
      coverageType: coverageTypeMap[data.coverageType] ?? 4,
    });
  },

  // ============================================
  // ORGANIZATION WALLET
  // ============================================

  getOrgWallet: async (): Promise<OrgWallet> => {
    return apiClient.getOrgWallet();
  },

  fundWallet: async (data: { phoneNumber: string; amountKES: number }): Promise<WalletFundResult> => {
    // Convert local phone format (07...) to international (+254...)
    const phoneNumber = data.phoneNumber.startsWith('0')
      ? '+254' + data.phoneNumber.slice(1)
      : data.phoneNumber;
    return apiClient.fundWallet({ ...data, phoneNumber });
  },

  // ============================================
  // PLATFORM POOLS
  // ============================================

  getPlatformPools: async (): Promise<{ total: number; pools: PlatformPool[] }> => {
    const result = await apiClient.platformGetPools();
    return {
      total: result.total,
      pools: result.pools.map((p) => ({
        address: p.address,
        name: p.name,
        symbol: p.symbol,
        poolType: p.poolType === 0 ? 'PUBLIC' : p.poolType === 1 ? 'PRIVATE' : 'MUTUAL',
        poolValue: parseFloat(p.poolValue),
        utilizationRate: p.utilizationRate,
        organizationId: p.organizationId,
        organizationName: p.organizationName,
      })),
    };
  },

  getPlatformPoolCounts: async (): Promise<PoolCounts> => {
    return apiClient.platformGetPoolCounts();
  },

  deployPoolForOrg: async (orgId: string, data: DeployPoolRequest): Promise<DeployPoolResult> => {
    const coverageTypeMap = { DROUGHT: 0, FLOOD: 1, PEST: 2, DISEASE: 3, COMPREHENSIVE: 4 };
    return apiClient.platformDeployPoolForOrg(orgId, {
      ...data,
      coverageType: coverageTypeMap[data.coverageType],
    });
  },

  createPublicPool: async (data: Omit<DeployPoolRequest, 'poolType' | 'minDeposit' | 'maxDeposit' | 'poolOwner'>): Promise<DeployPoolResult> => {
    const coverageTypeMap = { DROUGHT: 0, FLOOD: 1, PEST: 2, DISEASE: 3, COMPREHENSIVE: 4 };
    return apiClient.platformCreatePublicPool({
      ...data,
      coverageType: coverageTypeMap[data.coverageType],
    });
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

  platformDeployPool: async (orgId: string, initialCapital: number) => {
    return apiClient.platformDeployPool(orgId, initialCapital);
  },

  getPoolByAddress: async (poolAddress: string): Promise<PoolStatus> => {
    return apiClient.platformGetPoolByAddress(poolAddress);
  },

  getPoolById: async (poolId: string): Promise<PoolStatus> => {
    return apiClient.platformGetPoolById(poolId);
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
  // POOL MANAGEMENT (additional)
  // ============================================

  addPoolDepositor: async (depositorAddress: string) => {
    return apiClient.addPoolDepositor(depositorAddress);
  },

  removePoolDepositor: async (depositorAddress: string) => {
    return apiClient.removePoolDepositor(depositorAddress);
  },

  getInvestorInfo: async (poolAddress: string): Promise<InvestorInfo> => {
    return apiClient.getInvestorInfo(poolAddress);
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
    coverageType: 'DROUGHT' | 'FLOOD' | 'BOTH' | 'COMPREHENSIVE';
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
    coverageType: 'DROUGHT' | 'FLOOD' | 'BOTH' | 'COMPREHENSIVE';
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

  checkPolicyExpiry: async (policyId: string): Promise<PolicyExpireCheck> => {
    return apiClient.checkPolicyExpiry(policyId);
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
  // PAYMENTS
  // ============================================

  getPayments: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    farmerId?: string;
  }) => {
    const result = await apiClient.getPayments(params);
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getPayment: async (paymentId: string): Promise<Payment> => {
    return apiClient.getPayment(paymentId);
  },

  getPaymentByRef: async (mpesaRef: string): Promise<Payment> => {
    return apiClient.getPaymentByRef(mpesaRef);
  },

  // ============================================
  // TREASURY (additional)
  // ============================================

  getTreasuryBalance: async () => {
    return apiClient.platformGetTreasuryBalance();
  },

  getTreasuryPremiumAmounts: async (): Promise<TreasuryPremiumAmounts> => {
    return apiClient.platformGetTreasuryPremiumAmounts();
  },

  getTreasuryPayoutAmounts: async (): Promise<TreasuryPayoutAmounts> => {
    return apiClient.platformGetTreasuryPayoutAmounts();
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
};
