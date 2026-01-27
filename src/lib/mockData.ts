import type {
  User,
  Organization,
  OrganizationStats,
  Farmer,
  Plot,
  Policy,
  Payout,
  DamageAssessment,
  Activity,
  LiquidityPool,
  PlatformStats,
  RevenueAnalytics,
  PoliciesAnalytics,
  FarmersAnalytics,
  PayoutsAnalytics,
  DamageAnalytics,
  FinancialSummary,
} from '@/types';

// Mock Users
export const mockUsers: User[] = [
  {
    id: 'u1',
    email: 'admin@microcrop.io',
    firstName: 'John',
    lastName: 'Admin',
    role: 'PLATFORM_ADMIN',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLoginAt: '2025-01-27T08:00:00Z',
  },
  {
    id: 'u2',
    email: 'manager@greenfields.co.ke',
    firstName: 'Jane',
    lastName: 'Manager',
    phone: '+254700000001',
    role: 'ORG_ADMIN',
    organizationId: 'org1',
    isActive: true,
    createdAt: '2024-02-15T00:00:00Z',
    lastLoginAt: '2025-01-27T07:30:00Z',
  },
  {
    id: 'u3',
    email: 'staff@greenfields.co.ke',
    firstName: 'Peter',
    lastName: 'Staff',
    phone: '+254700000002',
    role: 'ORG_STAFF',
    organizationId: 'org1',
    isActive: true,
    createdAt: '2024-03-01T00:00:00Z',
    lastLoginAt: '2025-01-26T15:00:00Z',
  },
];

// Mock Organizations
export const mockOrganizations: Organization[] = [
  {
    id: 'org1',
    name: 'Green Fields Cooperative',
    type: 'COOPERATIVE',
    isActive: true,
    poolAddress: '0x1234567890abcdef1234567890abcdef12345678',
    onboardingStep: 'ACTIVATED',
    farmersCount: 1250,
    policiesCount: 890,
    payoutsCount: 156,
    usersCount: 8,
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'org2',
    name: 'Harvest Partners Ltd',
    type: 'AGGREGATOR',
    isActive: true,
    poolAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    onboardingStep: 'ACTIVATED',
    farmersCount: 850,
    policiesCount: 620,
    payoutsCount: 98,
    usersCount: 5,
    createdAt: '2024-02-20T00:00:00Z',
  },
  {
    id: 'org3',
    name: 'AgroSecure Insurance',
    type: 'INSURER',
    isActive: true,
    poolAddress: '0x567890abcdef1234567890abcdef123456789012',
    onboardingStep: 'FUNDED',
    farmersCount: 320,
    policiesCount: 180,
    payoutsCount: 24,
    usersCount: 3,
    createdAt: '2024-05-10T00:00:00Z',
  },
  {
    id: 'org4',
    name: 'County Agriculture Office',
    type: 'GOVERNMENT',
    isActive: false,
    onboardingStep: 'CONFIGURED',
    farmersCount: 0,
    policiesCount: 0,
    payoutsCount: 0,
    usersCount: 2,
    createdAt: '2024-08-01T00:00:00Z',
  },
];

// Mock Organization Stats
export const mockOrgStats: Record<string, OrganizationStats> = {
  org1: {
    totalFarmers: 1250,
    activePolicies: 890,
    totalPremiums: 4500000,
    totalPayouts: 1800000,
    totalFees: 225000,
    lossRatio: 0.4,
  },
  org2: {
    totalFarmers: 850,
    activePolicies: 620,
    totalPremiums: 3100000,
    totalPayouts: 1550000,
    totalFees: 155000,
    lossRatio: 0.5,
  },
};

// Mock Farmers
export const mockFarmers: Farmer[] = [
  {
    id: 'f1',
    organizationId: 'org1',
    firstName: 'John',
    lastName: 'Kamau',
    phone: '+254712345678',
    nationalId: '12345678',
    county: 'Nakuru',
    kycStatus: 'APPROVED',
    plotsCount: 3,
    policiesCount: 2,
    createdAt: '2024-03-15T00:00:00Z',
  },
  {
    id: 'f2',
    organizationId: 'org1',
    firstName: 'Mary',
    lastName: 'Wanjiku',
    phone: '+254712345679',
    nationalId: '23456789',
    county: 'Kiambu',
    kycStatus: 'APPROVED',
    plotsCount: 2,
    policiesCount: 1,
    createdAt: '2024-03-20T00:00:00Z',
  },
  {
    id: 'f3',
    organizationId: 'org1',
    firstName: 'David',
    lastName: 'Ochieng',
    phone: '+254712345680',
    nationalId: '34567890',
    county: 'Kisumu',
    kycStatus: 'PENDING',
    plotsCount: 1,
    policiesCount: 0,
    createdAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'f4',
    organizationId: 'org1',
    firstName: 'Grace',
    lastName: 'Muthoni',
    phone: '+254712345681',
    nationalId: '45678901',
    county: 'Nakuru',
    kycStatus: 'REJECTED',
    kycRejectionReason: 'Invalid ID document',
    plotsCount: 0,
    policiesCount: 0,
    createdAt: '2024-04-10T00:00:00Z',
  },
  {
    id: 'f5',
    organizationId: 'org1',
    firstName: 'Peter',
    lastName: 'Njoroge',
    phone: '+254712345682',
    nationalId: '56789012',
    county: 'Uasin Gishu',
    kycStatus: 'APPROVED',
    plotsCount: 4,
    policiesCount: 3,
    createdAt: '2024-04-15T00:00:00Z',
  },
];

// Mock Plots
export const mockPlots: Plot[] = [
  {
    id: 'p1',
    farmerId: 'f1',
    farmerName: 'John Kamau',
    name: 'Kamau Farm Block A',
    latitude: -0.3031,
    longitude: 36.0800,
    acreage: 2.5,
    cropType: 'Maize',
    policiesCount: 1,
    latestNdvi: 0.72,
    latestTemperature: 24.5,
    latestRainfall: 45.2,
    createdAt: '2024-03-16T00:00:00Z',
  },
  {
    id: 'p2',
    farmerId: 'f1',
    farmerName: 'John Kamau',
    name: 'Kamau Farm Block B',
    latitude: -0.3035,
    longitude: 36.0805,
    acreage: 1.8,
    cropType: 'Wheat',
    policiesCount: 1,
    latestNdvi: 0.68,
    latestTemperature: 24.2,
    latestRainfall: 44.8,
    createdAt: '2024-03-16T00:00:00Z',
  },
  {
    id: 'p3',
    farmerId: 'f2',
    farmerName: 'Mary Wanjiku',
    name: 'Wanjiku Plot 1',
    latitude: -1.0432,
    longitude: 37.0150,
    acreage: 3.2,
    cropType: 'Coffee',
    policiesCount: 1,
    latestNdvi: 0.81,
    latestTemperature: 22.1,
    latestRainfall: 52.3,
    createdAt: '2024-03-21T00:00:00Z',
  },
  {
    id: 'p4',
    farmerId: 'f5',
    farmerName: 'Peter Njoroge',
    name: 'Njoroge Wheat Field',
    latitude: 0.5165,
    longitude: 35.2820,
    acreage: 5.0,
    cropType: 'Wheat',
    policiesCount: 2,
    latestNdvi: 0.65,
    latestTemperature: 21.8,
    latestRainfall: 38.5,
    createdAt: '2024-04-16T00:00:00Z',
  },
  {
    id: 'p5',
    farmerId: 'f5',
    farmerName: 'Peter Njoroge',
    name: 'Njoroge Maize Farm',
    latitude: 0.5170,
    longitude: 35.2825,
    acreage: 4.2,
    cropType: 'Maize',
    policiesCount: 1,
    latestNdvi: 0.58,
    latestTemperature: 22.0,
    latestRainfall: 37.9,
    createdAt: '2024-04-16T00:00:00Z',
  },
];

// Mock Policies
export const mockPolicies: Policy[] = [
  {
    id: 'pol1',
    policyNumber: 'POL-2024-001',
    organizationId: 'org1',
    farmerId: 'f1',
    farmerName: 'John Kamau',
    plotId: 'p1',
    plotName: 'Kamau Farm Block A',
    status: 'ACTIVE',
    coverageType: 'BOTH',
    cropType: 'Maize',
    sumInsured: 150000,
    premium: 7500,
    platformFee: 375,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-06-30T00:00:00Z',
    createdAt: '2024-12-28T00:00:00Z',
  },
  {
    id: 'pol2',
    policyNumber: 'POL-2024-002',
    organizationId: 'org1',
    farmerId: 'f1',
    farmerName: 'John Kamau',
    plotId: 'p2',
    plotName: 'Kamau Farm Block B',
    status: 'ACTIVE',
    coverageType: 'DROUGHT',
    cropType: 'Wheat',
    sumInsured: 100000,
    premium: 5000,
    platformFee: 250,
    startDate: '2025-01-15T00:00:00Z',
    endDate: '2025-07-15T00:00:00Z',
    createdAt: '2025-01-10T00:00:00Z',
  },
  {
    id: 'pol3',
    policyNumber: 'POL-2024-003',
    organizationId: 'org1',
    farmerId: 'f2',
    farmerName: 'Mary Wanjiku',
    plotId: 'p3',
    plotName: 'Wanjiku Plot 1',
    status: 'CLAIMED',
    coverageType: 'FLOOD',
    cropType: 'Coffee',
    sumInsured: 200000,
    premium: 10000,
    platformFee: 500,
    startDate: '2024-10-01T00:00:00Z',
    endDate: '2025-03-31T00:00:00Z',
    createdAt: '2024-09-25T00:00:00Z',
  },
  {
    id: 'pol4',
    policyNumber: 'POL-2024-004',
    organizationId: 'org1',
    farmerId: 'f5',
    farmerName: 'Peter Njoroge',
    plotId: 'p4',
    plotName: 'Njoroge Wheat Field',
    status: 'EXPIRED',
    coverageType: 'BOTH',
    cropType: 'Wheat',
    sumInsured: 250000,
    premium: 12500,
    platformFee: 625,
    startDate: '2024-06-01T00:00:00Z',
    endDate: '2024-12-01T00:00:00Z',
    createdAt: '2024-05-28T00:00:00Z',
  },
  {
    id: 'pol5',
    policyNumber: 'POL-2025-001',
    organizationId: 'org1',
    farmerId: 'f5',
    farmerName: 'Peter Njoroge',
    plotId: 'p5',
    plotName: 'Njoroge Maize Farm',
    status: 'ACTIVE',
    coverageType: 'DROUGHT',
    cropType: 'Maize',
    sumInsured: 180000,
    premium: 9000,
    platformFee: 450,
    startDate: '2025-01-20T00:00:00Z',
    endDate: '2025-07-20T00:00:00Z',
    createdAt: '2025-01-18T00:00:00Z',
  },
];

// Mock Payouts
export const mockPayouts: Payout[] = [
  {
    id: 'pay1',
    policyId: 'pol3',
    policyNumber: 'POL-2024-003',
    farmerId: 'f2',
    farmerName: 'Mary Wanjiku',
    farmerPhone: '+254712345679',
    amount: 120000,
    status: 'COMPLETED',
    transactionHash: '0xabc123def456789...',
    processedAt: '2025-01-15T10:30:00Z',
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'pay2',
    policyId: 'pol4',
    policyNumber: 'POL-2024-004',
    farmerId: 'f5',
    farmerName: 'Peter Njoroge',
    farmerPhone: '+254712345682',
    amount: 75000,
    status: 'COMPLETED',
    transactionHash: '0xdef789abc123456...',
    processedAt: '2024-11-20T14:15:00Z',
    createdAt: '2024-11-20T14:00:00Z',
  },
  {
    id: 'pay3',
    policyId: 'pol1',
    policyNumber: 'POL-2024-001',
    farmerId: 'f1',
    farmerName: 'John Kamau',
    farmerPhone: '+254712345678',
    amount: 45000,
    status: 'PENDING',
    createdAt: '2025-01-26T09:00:00Z',
  },
  {
    id: 'pay4',
    policyId: 'pol2',
    policyNumber: 'POL-2024-002',
    farmerId: 'f1',
    farmerName: 'John Kamau',
    farmerPhone: '+254712345678',
    amount: 30000,
    status: 'FAILED',
    failureReason: 'Insufficient pool balance',
    createdAt: '2025-01-25T11:00:00Z',
  },
];

// Mock Damage Assessments
export const mockDamageAssessments: DamageAssessment[] = [
  {
    id: 'da1',
    policyId: 'pol1',
    policyNumber: 'POL-2024-001',
    plotId: 'p1',
    plotName: 'Kamau Farm Block A',
    latitude: -0.3031,
    longitude: 36.0800,
    weatherDamageScore: 0.35,
    satelliteDamageScore: 0.42,
    combinedDamageScore: 0.38,
    isTriggered: false,
    assessmentDate: '2025-01-25T00:00:00Z',
    createdAt: '2025-01-25T06:00:00Z',
  },
  {
    id: 'da2',
    policyId: 'pol3',
    policyNumber: 'POL-2024-003',
    plotId: 'p3',
    plotName: 'Wanjiku Plot 1',
    latitude: -1.0432,
    longitude: 37.0150,
    weatherDamageScore: 0.72,
    satelliteDamageScore: 0.68,
    combinedDamageScore: 0.70,
    isTriggered: true,
    assessmentDate: '2025-01-10T00:00:00Z',
    createdAt: '2025-01-10T06:00:00Z',
  },
  {
    id: 'da3',
    policyId: 'pol5',
    policyNumber: 'POL-2025-001',
    plotId: 'p5',
    plotName: 'Njoroge Maize Farm',
    latitude: 0.5170,
    longitude: 35.2825,
    weatherDamageScore: 0.55,
    satelliteDamageScore: 0.48,
    combinedDamageScore: 0.52,
    isTriggered: true,
    assessmentDate: '2025-01-24T00:00:00Z',
    createdAt: '2025-01-24T06:00:00Z',
  },
];

// Mock Activities
export const mockActivities: Activity[] = [
  {
    id: 'a1',
    type: 'PAYOUT_COMPLETED',
    message: 'Payout of KES 120,000 completed for Mary Wanjiku',
    organizationId: 'org1',
    createdAt: '2025-01-27T08:30:00Z',
  },
  {
    id: 'a2',
    type: 'POLICY_ACTIVATED',
    message: 'Policy POL-2025-001 activated for Peter Njoroge',
    organizationId: 'org1',
    createdAt: '2025-01-27T07:15:00Z',
  },
  {
    id: 'a3',
    type: 'FARMER_REGISTERED',
    message: 'New farmer Grace Muthoni registered',
    organizationId: 'org1',
    createdAt: '2025-01-26T16:45:00Z',
  },
  {
    id: 'a4',
    type: 'PAYOUT_FAILED',
    message: 'Payout of KES 30,000 failed for John Kamau',
    organizationId: 'org1',
    createdAt: '2025-01-25T11:00:00Z',
  },
  {
    id: 'a5',
    type: 'FARMER_KYC_UPDATED',
    message: 'KYC status updated to Rejected for Grace Muthoni',
    organizationId: 'org1',
    createdAt: '2025-01-25T09:30:00Z',
  },
  {
    id: 'a6',
    type: 'ORG_ACTIVATED',
    message: 'Organization AgroSecure Insurance activated',
    createdAt: '2025-01-24T14:00:00Z',
  },
  {
    id: 'a7',
    type: 'PLOT_CREATED',
    message: 'New plot Njoroge Maize Farm created for Peter Njoroge',
    organizationId: 'org1',
    createdAt: '2025-01-23T10:20:00Z',
  },
];

// Mock Liquidity Pool
export const mockLiquidityPool: LiquidityPool = {
  address: '0x1234567890abcdef1234567890abcdef12345678',
  balance: 2500000,
  utilizationRate: 0.32,
  capitalDeposited: 3000000,
  premiumsReceived: 450000,
  payoutsSent: 800000,
  feesPaid: 150000,
  availableForWithdrawal: 1700000,
};

// Mock Platform Stats
export const mockPlatformStats: PlatformStats = {
  totalOrganizations: 4,
  activeOrganizations: 3,
  totalFarmers: 2420,
  activePolicies: 1690,
  newPoliciesPeriod: 245,
  totalRevenue: 535000,
  premiumsCollected: 7600000,
  payoutsSent: 3350000,
};

// Mock Revenue Analytics
export const mockRevenueAnalytics: RevenueAnalytics = {
  totalFees: 535000,
  totalPremiums: 7600000,
  totalPayouts: 3350000,
  netRevenue: 4785000,
  timeSeries: [
    { date: '2025-01-01', fees: 15000, premiums: 250000, payouts: 80000 },
    { date: '2025-01-02', fees: 18000, premiums: 280000, payouts: 120000 },
    { date: '2025-01-03', fees: 12000, premiums: 200000, payouts: 50000 },
    { date: '2025-01-04', fees: 22000, premiums: 320000, payouts: 150000 },
    { date: '2025-01-05', fees: 16000, premiums: 240000, payouts: 90000 },
    { date: '2025-01-06', fees: 19000, premiums: 290000, payouts: 110000 },
    { date: '2025-01-07', fees: 21000, premiums: 310000, payouts: 140000 },
  ],
  byOrganization: [
    { name: 'Green Fields Cooperative', value: 225000 },
    { name: 'Harvest Partners Ltd', value: 155000 },
    { name: 'AgroSecure Insurance', value: 95000 },
    { name: 'Others', value: 60000 },
  ],
};

// Mock Policies Analytics
export const mockPoliciesAnalytics: PoliciesAnalytics = {
  totalPolicies: 2150,
  activePolicies: 1690,
  claimsRatio: 0.18,
  timeSeries: [
    { date: '2025-01-01', value: 45 },
    { date: '2025-01-02', value: 52 },
    { date: '2025-01-03', value: 38 },
    { date: '2025-01-04', value: 61 },
    { date: '2025-01-05', value: 48 },
    { date: '2025-01-06', value: 55 },
    { date: '2025-01-07', value: 42 },
  ],
  byStatus: [
    { name: 'Active', value: 1690 },
    { name: 'Expired', value: 320 },
    { name: 'Claimed', value: 98 },
    { name: 'Cancelled', value: 42 },
  ],
  byCoverage: [
    { name: 'Drought', value: 850 },
    { name: 'Flood', value: 420 },
    { name: 'Both', value: 880 },
  ],
};

// Mock Farmers Analytics
export const mockFarmersAnalytics: FarmersAnalytics = {
  totalFarmers: 2420,
  newFarmers: 156,
  timeSeries: [
    { date: '2025-01-01', value: 22 },
    { date: '2025-01-02', value: 28 },
    { date: '2025-01-03', value: 18 },
    { date: '2025-01-04', value: 35 },
    { date: '2025-01-05', value: 24 },
    { date: '2025-01-06', value: 31 },
    { date: '2025-01-07', value: 19 },
  ],
  byKycStatus: [
    { name: 'Approved', value: 2180 },
    { name: 'Pending', value: 185 },
    { name: 'Rejected', value: 55 },
  ],
  byCounty: [
    { name: 'Nakuru', value: 520 },
    { name: 'Uasin Gishu', value: 480 },
    { name: 'Trans Nzoia', value: 410 },
    { name: 'Kiambu', value: 380 },
    { name: 'Kisumu', value: 320 },
    { name: 'Others', value: 310 },
  ],
};

// Mock Payouts Analytics
export const mockPayoutsAnalytics: PayoutsAnalytics = {
  totalAmount: 3350000,
  avgAmount: 68367,
  count: 49,
  successRate: 0.92,
  timeSeries: [
    { date: '2025-01-01', amount: 120000, count: 2 },
    { date: '2025-01-02', amount: 185000, count: 3 },
    { date: '2025-01-03', amount: 95000, count: 1 },
    { date: '2025-01-04', amount: 250000, count: 4 },
    { date: '2025-01-05', amount: 145000, count: 2 },
    { date: '2025-01-06', amount: 210000, count: 3 },
    { date: '2025-01-07', amount: 175000, count: 2 },
  ],
  byStatus: [
    { name: 'Completed', value: 45 },
    { name: 'Pending', value: 2 },
    { name: 'Failed', value: 2 },
  ],
};

// Mock Damage Analytics
export const mockDamageAnalytics: DamageAnalytics = {
  avgWeatherScore: 0.42,
  avgSatelliteScore: 0.38,
  avgCombinedScore: 0.40,
  triggerRate: 0.24,
  assessments: mockDamageAssessments,
  totalCount: 156,
};

// Mock Financial Summary
export const mockFinancialSummary: FinancialSummary = {
  totalPremiums: 4500000,
  totalPayouts: 1800000,
  totalFees: 225000,
  lossRatio: 0.4,
  avgPremium: 8500,
  policyCount: 890,
};

// Helper function to simulate API delay
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API functions
export const mockApi = {
  // Auth
  login: async (email: string, password: string) => {
    await delay(500);
    const user = mockUsers.find(u => u.email === email);
    if (!user || password !== 'password123') {
      throw new Error('Invalid credentials');
    }
    return {
      user,
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: Date.now() + 3600000, // 1 hour
      },
    };
  },

  // Platform Stats
  getPlatformStats: async () => {
    await delay(300);
    return mockPlatformStats;
  },

  // Organizations
  getOrganizations: async () => {
    await delay(300);
    return { data: mockOrganizations, total: mockOrganizations.length };
  },

  getOrganization: async (id: string) => {
    await delay(200);
    return mockOrganizations.find(o => o.id === id);
  },

  getOrganizationStats: async (id: string) => {
    await delay(200);
    return mockOrgStats[id] || mockOrgStats.org1;
  },

  // Farmers
  getFarmers: async (orgId: string) => {
    await delay(300);
    const farmers = mockFarmers.filter(f => f.organizationId === orgId);
    return { data: farmers, total: farmers.length };
  },

  getFarmer: async (id: string) => {
    await delay(200);
    return mockFarmers.find(f => f.id === id);
  },

  // Plots
  getPlots: async (orgId: string) => {
    await delay(300);
    return { data: mockPlots, total: mockPlots.length };
  },

  // Policies
  getPolicies: async (orgId: string) => {
    await delay(300);
    const policies = mockPolicies.filter(p => p.organizationId === orgId);
    return { data: policies, total: policies.length };
  },

  getPolicy: async (id: string) => {
    await delay(200);
    return mockPolicies.find(p => p.id === id);
  },

  // Payouts
  getPayouts: async (orgId: string) => {
    await delay(300);
    return { data: mockPayouts, total: mockPayouts.length };
  },

  // Damage Assessments
  getDamageAssessments: async () => {
    await delay(300);
    return { data: mockDamageAssessments, total: mockDamageAssessments.length };
  },

  // Activities
  getActivities: async (orgId?: string) => {
    await delay(200);
    const activities = orgId 
      ? mockActivities.filter(a => a.organizationId === orgId || !a.organizationId)
      : mockActivities;
    return { data: activities, total: activities.length };
  },

  // Pool
  getLiquidityPool: async () => {
    await delay(200);
    return mockLiquidityPool;
  },

  // Analytics
  getRevenueAnalytics: async () => {
    await delay(400);
    return mockRevenueAnalytics;
  },

  getPoliciesAnalytics: async () => {
    await delay(400);
    return mockPoliciesAnalytics;
  },

  getFarmersAnalytics: async () => {
    await delay(400);
    return mockFarmersAnalytics;
  },

  getPayoutsAnalytics: async () => {
    await delay(400);
    return mockPayoutsAnalytics;
  },

  getDamageAnalytics: async () => {
    await delay(400);
    return mockDamageAnalytics;
  },

  getFinancialSummary: async () => {
    await delay(300);
    return mockFinancialSummary;
  },
};
