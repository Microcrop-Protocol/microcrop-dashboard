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
  PoolStatus,
  PoolDepositResult,
  PoolWithdrawResult,
  PoolSettings,
  PlatformPool,
  PoolCounts,
  TreasuryStats,
  DeployPoolRequest,
  DeployPoolResult,
} from '@/types';

const USE_MOCK_API = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === 'true';

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
};

export default api;
