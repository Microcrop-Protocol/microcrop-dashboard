/**
 * API Service Layer
 *
 * This module provides a unified API interface that can switch between:
 * - Real backend API (apiClient)
 * - Mock API (mockApi) for development/testing
 *
 * Set VITE_USE_MOCK_API=true in .env to use mock data
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
} from '@/types';

// Use mock API when explicitly enabled, or when no real API URL is configured
const USE_MOCK_API =
  import.meta.env.VITE_USE_MOCK_API === 'true' || !import.meta.env.VITE_API_URL;

// Lazy-load mock data only in dev — excluded from production bundle
const getMockApi = async () => {
  const mod = await import('../mockData');
  return mod;
};

// Helper to log which API is being used
const logApiCall = (method: string) => {
  if (import.meta.env.DEV) {
    console.log(`[API] ${method} - Using ${USE_MOCK_API ? 'MOCK' : 'REAL'} API`);
  }
};

/**
 * Unified API Service
 * Switches between mock and real API based on environment
 */
export const api = {
  // ============================================
  // AUTH
  // ============================================

  login: async (email: string, password: string) => {
    logApiCall('login');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.login(email, password);
    }
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
    logApiCall('getMe');
    if (USE_MOCK_API) {
      // Mock implementation would need stored user
      throw new Error('Not implemented in mock');
    }
    return apiClient.getMe();
  },

  refreshToken: async (refreshToken: string) => {
    logApiCall('refreshToken');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.refreshToken(refreshToken);
  },

  forgotPassword: async (email: string) => {
    logApiCall('forgotPassword');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.forgotPassword(email);
    }
    return apiClient.forgotPassword(email);
  },

  resetPassword: async (token: string, password: string) => {
    logApiCall('resetPassword');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.resetPassword(token, password);
    }
    return apiClient.resetPassword(token, password);
  },

  // ============================================
  // PLATFORM STATS
  // ============================================

  getPlatformStats: async () => {
    logApiCall('getPlatformStats');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPlatformStats();
    }
    const overview = await apiClient.platformDashboardOverview();
    return {
      totalOrganizations: overview.organizations.total,
      activeOrganizations: overview.organizations.active,
      totalFarmers: overview.farmers.total,
      activePolicies: overview.policies.active,
      newPoliciesPeriod: overview.policies.periodNew,
      totalRevenue: overview.financials.totalRevenue,
      premiumsCollected: overview.financials.totalPremiums,
      payoutsSent: overview.financials.totalPayouts,
    };
  },

  // ============================================
  // ORGANIZATIONS
  // ============================================

  getOrganizations: async () => {
    logApiCall('getOrganizations');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getOrganizations();
    }
    const result = await apiClient.platformDashboardOrganizations();
    // Transform to match expected format
    const data = result.data.map((org: any) => ({
      id: org.id,
      name: org.name,
      type: org.type,
      isActive: org.isActive,
      poolAddress: org.poolAddress,
      onboardingStep: org.onboardingStep || 'REGISTERED',
      farmersCount: org._count?.farmers || 0,
      policiesCount: org._count?.policies || 0,
      payoutsCount: org._count?.payouts || 0,
      usersCount: org._count?.users || 0,
      createdAt: org.createdAt,
      kybStatus: org.kybStatus,
      contactEmail: org.contactEmail,
      contactPhone: org.contactPhone,
      contactPersonName: org.contactPerson,
    }));
    return { data, total: result.pagination?.total || data.length };
  },

  getOrganization: async (id: string) => {
    logApiCall('getOrganization');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getOrganization(id);
    }
    const org = await apiClient.platformGetOrganization(id);
    return {
      ...org,
      farmersCount: org._count?.farmers || 0,
      policiesCount: org._count?.policies || 0,
      payoutsCount: org._count?.payouts || 0,
      usersCount: org._count?.users || 0,
    };
  },

  getOrganizationStats: async (id: string) => {
    logApiCall('getOrganizationStats');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getOrganizationStats(id);
    }
    const metrics = await apiClient.platformDashboardOrgMetrics(id);
    return {
      totalFarmers: metrics.farmers.total,
      activePolicies: metrics.policies.byStatus?.ACTIVE || 0,
      totalPremiums: metrics.policies.totalPremiums,
      totalPayouts: metrics.payouts.totalAmount,
      totalFees: metrics.fees.total,
      lossRatio: metrics.lossRatio,
    };
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
    logApiCall('adminCreateOrganization');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.adminCreateOrganization(data);
    }
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
    // Optional fields
    county?: string;
    estimatedFarmers?: number;
    website?: string;
    description?: string;
    documents: { type: 'BUSINESS_REGISTRATION_CERT' | 'TAX_PIN_CERT'; fileName: string; fileSize: number; file?: File }[];
  }) => {
    logApiCall('submitOrgApplication');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.submitOrgApplication(data);
    }

    // Build FormData for file upload
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('registrationNumber', data.registrationNumber);
    formData.append('type', data.type);
    formData.append('contactFirstName', data.contactFirstName);
    formData.append('contactLastName', data.contactLastName);
    formData.append('contactEmail', data.contactEmail);
    formData.append('contactPhone', data.contactPhone);

    // Optional fields
    if (data.county) formData.append('county', data.county);
    if (data.estimatedFarmers) formData.append('estimatedFarmers', data.estimatedFarmers.toString());
    if (data.website) formData.append('website', data.website);
    if (data.description) formData.append('description', data.description);

    // Append files
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
    logApiCall('getOrgApplications');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getOrgApplications(status);
    }
    const result = await apiClient.getOrgApplications({ status });
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getOrgApplication: async (id: string) => {
    logApiCall('getOrgApplication');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getOrgApplication(id);
    }
    return apiClient.getOrgApplication(id);
  },

  verifyKYB: async (applicationId: string, verification: { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string }) => {
    logApiCall('verifyKYB');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.verifyKYB(applicationId, verification);
    }
    return apiClient.verifyKybApplication(applicationId, verification);
  },

  getPendingKYBCount: async () => {
    logApiCall('getPendingKYBCount');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPendingKYBCount();
    }
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
    logApiCall('createOrgAdminInvitation');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.createOrgAdminInvitation(data);
    }
    return apiClient.createInvitation(data);
  },

  sendOrgAdminInvitation: async (invitationId: string) => {
    logApiCall('sendOrgAdminInvitation');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.sendOrgAdminInvitation(invitationId);
    }
    return apiClient.sendInvitation(invitationId);
  },

  getOrgInvitations: async (organizationId?: string) => {
    logApiCall('getOrgInvitations');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getOrgInvitations(organizationId);
    }
    const result = await apiClient.getInvitations({ organizationId });
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getInvitation: async (id: string) => {
    logApiCall('getInvitation');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getInvitation(id);
    }
    // Real API doesn't have single invitation endpoint yet
    throw new Error('Not implemented');
  },

  validateInvitationToken: async (token: string) => {
    logApiCall('validateInvitationToken');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.validateInvitationToken(token);
    }
    return apiClient.validateInvitationToken(token);
  },

  acceptInvitation: async (token: string, password: string) => {
    logApiCall('acceptInvitation');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.acceptInvitation(token, password);
    }
    return apiClient.acceptInvitation(token, password);
  },

  // ============================================
  // FARMERS
  // ============================================

  getFarmers: async (orgId: string, params?: { kycStatus?: string; search?: string }) => {
    logApiCall('getFarmers');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getFarmers(orgId);
    }
    const result = await apiClient.getFarmers(params);
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getFarmer: async (id: string) => {
    logApiCall('getFarmer');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getFarmer(id);
    }
    return apiClient.getFarmer(id);
  },

  // ============================================
  // PLOTS
  // ============================================

  getPlots: async (orgId: string) => {
    logApiCall('getPlots');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPlots(orgId);
    }
    const result = await apiClient.orgDashboardPlots();
    return { data: result.data.data, total: result.pagination?.total || result.data.data.length };
  },

  // ============================================
  // POLICIES
  // ============================================

  getPolicies: async (orgId: string) => {
    logApiCall('getPolicies');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPolicies(orgId);
    }
    const result = await apiClient.getPolicies();
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getPolicy: async (id: string) => {
    logApiCall('getPolicy');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPolicy(id);
    }
    return apiClient.getPolicy(id);
  },

  // ============================================
  // PAYOUTS
  // ============================================

  getPayouts: async (orgId: string) => {
    logApiCall('getPayouts');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPayouts(orgId);
    }
    const result = await apiClient.getPayouts();
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  // ============================================
  // DAMAGE ASSESSMENTS
  // ============================================

  getDamageAssessments: async () => {
    logApiCall('getDamageAssessments');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getDamageAssessments();
    }
    const result = await apiClient.orgDashboardDamageAssessments();
    return { data: result, total: result.length };
  },

  // ============================================
  // ACTIVITIES
  // ============================================

  getActivities: async (orgId?: string) => {
    logApiCall('getActivities');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getActivities(orgId);
    }
    const result = orgId
      ? await apiClient.orgDashboardActivity()
      : await apiClient.platformActivity();
    return { data: result.activity, total: result.activity.length };
  },

  // ============================================
  // POOL
  // ============================================

  getLiquidityPool: async () => {
    logApiCall('getLiquidityPool');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getLiquidityPool();
    }
    const pool = await apiClient.getOrganizationPool();
    return {
      address: pool.poolAddress,
      balance: pool.balance,
      utilizationRate: pool.utilizationRate,
      capitalDeposited: pool.totalCapitalDeposited,
      premiumsReceived: pool.totalPremiumsReceived,
      payoutsSent: pool.totalPayoutsSent,
      feesPaid: pool.totalFeesPaid,
      availableForWithdrawal: pool.balance - (pool.balance * pool.utilizationRate / 100),
    };
  },

  getPoolDetails: async (): Promise<PoolStatus> => {
    logApiCall('getPoolDetails');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPoolDetails();
    }
    const pool = await apiClient.getOrganizationPoolDetails();
    return {
      poolAddress: pool.poolAddress,
      poolValue: parseFloat(pool.poolValue),
      totalSupply: parseFloat(pool.totalSupply),
      tokenPrice: parseFloat(pool.tokenPrice),
      totalPremiums: parseFloat(pool.totalPremiums),
      totalPayouts: parseFloat(pool.totalPayouts),
      activeExposure: parseFloat(pool.activeExposure),
      minDeposit: parseFloat(pool.minDeposit),
      maxDeposit: parseFloat(pool.maxDeposit),
      targetCapital: parseFloat(pool.targetCapital),
      maxCapital: parseFloat(pool.maxCapital),
      depositsOpen: pool.depositsOpen,
      withdrawalsOpen: pool.withdrawalsOpen,
      paused: pool.paused,
      utilizationRate: pool.utilizationRate,
    };
  },

  depositToPool: async (data: { amount: number; minTokensOut?: number }): Promise<PoolDepositResult> => {
    logApiCall('depositToPool');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.depositToPool(data);
    }
    return apiClient.depositToPool(data);
  },

  withdrawFromPool: async (data: { tokenAmount: number; minUsdcOut?: number }): Promise<PoolWithdrawResult> => {
    logApiCall('withdrawFromPool');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.withdrawFromPool(data);
    }
    return apiClient.withdrawFromPool(data);
  },

  updatePoolSettings: async (settings: Partial<PoolSettings>): Promise<PoolSettings> => {
    logApiCall('updatePoolSettings');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.updatePoolSettings(settings);
    }
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
    logApiCall('deployOrgPool');
    const coverageTypeMap: Record<string, number> = { DROUGHT: 0, FLOOD: 1, PEST: 2, DISEASE: 3, COMPREHENSIVE: 4 };
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.deployOrgPool(data);
    }
    return apiClient.deployOrgPool({
      ...data,
      coverageType: coverageTypeMap[data.coverageType] ?? 4,
    });
  },

  // ============================================
  // ORGANIZATION WALLET
  // ============================================

  getOrgWallet: async (): Promise<OrgWallet> => {
    logApiCall('getOrgWallet');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getOrgWallet();
    }
    return apiClient.getOrgWallet();
  },

  fundWallet: async (data: { phoneNumber: string; amountKES: number }): Promise<WalletFundResult> => {
    logApiCall('fundWallet');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.fundWallet(data);
    }
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
    logApiCall('getPlatformPools');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPlatformPools();
    }
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
    logApiCall('getPlatformPoolCounts');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPlatformPoolCounts();
    }
    return apiClient.platformGetPoolCounts();
  },

  deployPoolForOrg: async (orgId: string, data: DeployPoolRequest): Promise<DeployPoolResult> => {
    logApiCall('deployPoolForOrg');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.deployPoolForOrg(orgId, data);
    }
    const coverageTypeMap = { DROUGHT: 0, FLOOD: 1, PEST: 2, DISEASE: 3, COMPREHENSIVE: 4 };
    return apiClient.platformDeployPoolForOrg(orgId, {
      ...data,
      coverageType: coverageTypeMap[data.coverageType],
    });
  },

  createPublicPool: async (data: Omit<DeployPoolRequest, 'poolType' | 'minDeposit' | 'maxDeposit' | 'poolOwner'>): Promise<DeployPoolResult> => {
    logApiCall('createPublicPool');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.createPublicPool(data);
    }
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
    logApiCall('getTreasuryStats');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getTreasuryStats();
    }
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
    logApiCall('getRevenueAnalytics');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getRevenueAnalytics();
    }
    return apiClient.platformAnalyticsRevenue();
  },

  getPoliciesAnalytics: async () => {
    logApiCall('getPoliciesAnalytics');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPoliciesAnalytics();
    }
    return apiClient.platformAnalyticsPolicies();
  },

  getFarmersAnalytics: async () => {
    logApiCall('getFarmersAnalytics');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getFarmersAnalytics();
    }
    return apiClient.platformAnalyticsFarmers();
  },

  getPayoutsAnalytics: async () => {
    logApiCall('getPayoutsAnalytics');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPayoutsAnalytics();
    }
    return apiClient.platformAnalyticsPayouts();
  },

  getDamageAnalytics: async () => {
    logApiCall('getDamageAnalytics');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getDamageAnalytics();
    }
    return apiClient.platformAnalyticsDamage();
  },

  getFinancialSummary: async () => {
    logApiCall('getFinancialSummary');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getFinancialSummary();
    }
    const financials = await apiClient.orgDashboardFinancials();
    return {
      totalPremiums: financials.allTime.premiums,
      totalPayouts: financials.allTime.payouts,
      totalFees: financials.allTime.fees,
      lossRatio: financials.period.lossRatio,
      avgPremium: financials.period.avgPremium,
      policyCount: financials.period.policyCount,
    };
  },

  // ============================================
  // STAFF
  // ============================================

  getStaff: async () => {
    logApiCall('getStaff');
    if (USE_MOCK_API) {
      // Mock implementation needed
      return [];
    }
    return apiClient.getStaff();
  },

  inviteStaff: async (data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: 'ORG_ADMIN' | 'ORG_STAFF';
  }) => {
    logApiCall('inviteStaff');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.inviteStaff(data);
  },

  updateStaffRole: async (userId: string, role: 'ORG_ADMIN' | 'ORG_STAFF') => {
    logApiCall('updateStaffRole');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.updateStaffRole(userId, role);
    }
    return apiClient.updateStaffRole(userId, role);
  },

  deactivateStaff: async (userId: string) => {
    logApiCall('deactivateStaff');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.deactivateStaff(userId);
    }
    return apiClient.deactivateStaff(userId);
  },

  reactivateStaff: async (userId: string) => {
    logApiCall('reactivateStaff');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.reactivateStaff(userId);
    }
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
    logApiCall('register');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.register(data);
    }
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
    logApiCall('configureOrganization');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformConfigureOrganization(orgId, config);
  },

  activateOrganization: async (orgId: string) => {
    logApiCall('activateOrganization');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformActivateOrganization(orgId);
  },

  deactivateOrganization: async (orgId: string) => {
    logApiCall('deactivateOrganization');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformDeactivateOrganization(orgId);
  },

  getOnboardingStatus: async (orgId: string): Promise<{ step: OnboardingStep; completedSteps: OnboardingStep[] }> => {
    logApiCall('getOnboardingStatus');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformGetOnboardingStatus(orgId);
  },

  platformDeployPool: async (orgId: string, initialCapital: number) => {
    logApiCall('platformDeployPool');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformDeployPool(orgId, initialCapital);
  },

  getPoolByAddress: async (poolAddress: string): Promise<PoolStatus> => {
    logApiCall('getPoolByAddress');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformGetPoolByAddress(poolAddress);
  },

  getPoolById: async (poolId: string): Promise<PoolStatus> => {
    logApiCall('getPoolById');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformGetPoolById(poolId);
  },

  // ============================================
  // ORG SELF-SERVICE
  // ============================================

  getMyOrganization: async () => {
    logApiCall('getMyOrganization');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getMyOrganization();
    }
    return apiClient.getMyOrganization();
  },

  getMyOrgStats: async () => {
    logApiCall('getMyOrgStats');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.getMyOrganizationStats();
  },

  updateOrgSettings: async (settings: {
    brandColor?: string;
    webhookUrl?: string;
    contactPhone?: string;
  }) => {
    logApiCall('updateOrgSettings');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.updateOrgSettings(settings);
    }
    return apiClient.updateOrganizationSettings(settings);
  },

  // ============================================
  // POOL MANAGEMENT (additional)
  // ============================================

  addPoolDepositor: async (depositorAddress: string) => {
    logApiCall('addPoolDepositor');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.addPoolDepositor(depositorAddress);
  },

  removePoolDepositor: async (depositorAddress: string) => {
    logApiCall('removePoolDepositor');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.removePoolDepositor(depositorAddress);
  },

  getInvestorInfo: async (poolAddress: string): Promise<InvestorInfo> => {
    logApiCall('getInvestorInfo');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
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
    logApiCall('registerFarmer');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.registerFarmer(data);
    }
    return apiClient.registerFarmer(data);
  },

  updateFarmer: async (farmerId: string, data: {
    phoneNumber?: string;
    ward?: string;
    village?: string;
  }): Promise<Farmer> => {
    logApiCall('updateFarmer');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.updateFarmer(farmerId, data);
    }
    return apiClient.updateFarmer(farmerId, data);
  },

  updateFarmerKyc: async (farmerId: string, data: {
    status: 'APPROVED' | 'REJECTED';
    reason?: string;
  }): Promise<Farmer> => {
    logApiCall('updateFarmerKyc');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.updateFarmerKyc(farmerId, data);
    }
    return apiClient.updateFarmerKyc(farmerId, data);
  },

  bulkImportFarmers: async (farmers: Record<string, unknown>[]) => {
    logApiCall('bulkImportFarmers');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.bulkImportFarmers(farmers);
  },

  bulkImportPlots: async (plots: Record<string, unknown>[]) => {
    logApiCall('bulkImportPlots');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
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
  }): Promise<Plot> => {
    logApiCall('createPlot');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.createPlot(farmerId, data);
    }
    return apiClient.createPlot(farmerId, data);
  },

  getPlot: async (plotId: string): Promise<Plot> => {
    logApiCall('getPlot');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPlot(plotId);
    }
    return apiClient.getPlot(plotId);
  },

  updatePlot: async (plotId: string, data: {
    name?: string;
    latitude?: number;
    longitude?: number;
    acreage?: number;
    cropType?: string;
  }): Promise<Plot> => {
    logApiCall('updatePlot');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.updatePlot(plotId, data);
    }
    return apiClient.updatePlot(plotId, data);
  },

  // ============================================
  // POLICY LIFECYCLE
  // ============================================

  getPolicyQuote: async (data: {
    farmerId: string;
    plotId: string;
    sumInsured: number;
    coverageType: 'DROUGHT' | 'FLOOD' | 'BOTH';
    durationDays: number;
  }): Promise<PolicyQuote> => {
    logApiCall('getPolicyQuote');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPolicyQuote(data);
    }
    return apiClient.getPolicyQuote(data);
  },

  purchasePolicy: async (data: {
    farmerId: string;
    plotId: string;
    sumInsured: number;
    coverageType: 'DROUGHT' | 'FLOOD' | 'BOTH';
    durationDays: number;
  }): Promise<Policy> => {
    logApiCall('purchasePolicy');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.purchasePolicy(data);
    }
    return apiClient.purchasePolicy(data);
  },

  getPolicyStatus: async (policyId: string): Promise<{ status: PolicyStatus }> => {
    logApiCall('getPolicyStatus');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.getPolicyStatus(policyId);
  },

  activatePolicy: async (policyId: string): Promise<Policy> => {
    logApiCall('activatePolicy');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.activatePolicy(policyId);
    }
    return apiClient.activatePolicy(policyId);
  },

  cancelPolicy: async (policyId: string, reason: string): Promise<Policy> => {
    logApiCall('cancelPolicy');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.cancelPolicy(policyId, reason);
    }
    return apiClient.cancelPolicy(policyId, reason);
  },

  checkPolicyExpiry: async (policyId: string): Promise<PolicyExpireCheck> => {
    logApiCall('checkPolicyExpiry');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.checkPolicyExpiry(policyId);
  },

  // ============================================
  // PAYOUT OPERATIONS
  // ============================================

  getPayout: async (payoutId: string): Promise<Payout> => {
    logApiCall('getPayout');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.getPayout(payoutId);
    }
    return apiClient.getPayout(payoutId);
  },

  retryPayout: async (payoutId: string): Promise<Payout> => {
    logApiCall('retryPayout');
    if (USE_MOCK_API) {
      return (await getMockApi()).mockApi.retryPayout(payoutId);
    }
    return apiClient.retryPayout(payoutId);
  },

  batchRetryPayouts: async (payoutIds?: string[], retryAllFailed?: boolean) => {
    logApiCall('batchRetryPayouts');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.batchRetryPayouts(payoutIds, retryAllFailed);
  },

  getPayoutReconciliation: async (params?: { startDate?: string; endDate?: string }) => {
    logApiCall('getPayoutReconciliation');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
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
    logApiCall('getPayments');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    const result = await apiClient.getPayments(params);
    return { data: result.data, total: result.pagination?.total || result.data.length };
  },

  getPayment: async (paymentId: string): Promise<Payment> => {
    logApiCall('getPayment');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.getPayment(paymentId);
  },

  getPaymentByRef: async (mpesaRef: string): Promise<Payment> => {
    logApiCall('getPaymentByRef');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.getPaymentByRef(mpesaRef);
  },

  // ============================================
  // TREASURY (additional)
  // ============================================

  getTreasuryBalance: async () => {
    logApiCall('getTreasuryBalance');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformGetTreasuryBalance();
  },

  getTreasuryPremiumAmounts: async (): Promise<TreasuryPremiumAmounts> => {
    logApiCall('getTreasuryPremiumAmounts');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformGetTreasuryPremiumAmounts();
  },

  getTreasuryPayoutAmounts: async (): Promise<TreasuryPayoutAmounts> => {
    logApiCall('getTreasuryPayoutAmounts');
    if (USE_MOCK_API) {
      throw new Error('Not implemented in mock');
    }
    return apiClient.platformGetTreasuryPayoutAmounts();
  },

  // ============================================
  // EXPORTS
  // ============================================

  exportFarmers: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    logApiCall('exportFarmers');
    if (USE_MOCK_API) {
      return new Blob(['mock CSV data'], { type: 'text/csv' });
    }
    return apiClient.exportFarmers(params);
  },

  exportPolicies: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    logApiCall('exportPolicies');
    if (USE_MOCK_API) {
      return new Blob(['mock CSV data'], { type: 'text/csv' });
    }
    return apiClient.exportPolicies(params);
  },

  exportPayouts: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    logApiCall('exportPayouts');
    if (USE_MOCK_API) {
      return new Blob(['mock CSV data'], { type: 'text/csv' });
    }
    return apiClient.exportPayouts(params);
  },

  exportTransactions: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    logApiCall('exportTransactions');
    if (USE_MOCK_API) {
      return new Blob(['mock CSV data'], { type: 'text/csv' });
    }
    return apiClient.exportTransactions(params);
  },

  exportPlatformOrganizations: async (params?: { period?: string }): Promise<Blob> => {
    logApiCall('exportPlatformOrganizations');
    if (USE_MOCK_API) {
      return new Blob(['mock CSV data'], { type: 'text/csv' });
    }
    return apiClient.exportPlatformOrganizations(params);
  },

  exportPlatformRevenue: async (params?: { period?: string; startDate?: string; endDate?: string }): Promise<Blob> => {
    logApiCall('exportPlatformRevenue');
    if (USE_MOCK_API) {
      return new Blob(['mock CSV data'], { type: 'text/csv' });
    }
    return apiClient.exportPlatformRevenue(params);
  },
};

export default api;
