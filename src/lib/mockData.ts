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
  OrganizationApplication,
  OrgAdminInvitation,
  KYBDocument,
  KYBVerification,
  ApplicationStatus,
  KYBStatus,
  OrganizationType,
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
    type: 'NGO',
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
    type: 'INSURANCE_COMPANY',
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

// Mock Pool Details (Enhanced)
export const mockPoolDetails: PoolStatus = {
  poolAddress: '0x1234567890abcdef1234567890abcdef12345678',
  poolValue: 2500000,
  totalSupply: 2400000,
  tokenPrice: 1.0417,
  totalPremiums: 450000,
  totalPayouts: 800000,
  activeExposure: 1250000,
  minDeposit: 100,
  maxDeposit: 1000000,
  targetCapital: 2000000,
  maxCapital: 5000000,
  depositsOpen: true,
  withdrawalsOpen: true,
  paused: false,
  utilizationRate: 50,
};

// Mock Platform Pools
export const mockPlatformPools: PlatformPool[] = [
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Green Fields Insurance Pool',
    symbol: 'GFPOOL',
    poolType: 'PRIVATE',
    poolValue: 2500000,
    utilizationRate: 50,
    organizationId: 'org1',
    organizationName: 'Green Fields Cooperative',
  },
  {
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    name: 'Harvest Partners Pool',
    symbol: 'HPPOOL',
    poolType: 'PRIVATE',
    poolValue: 1800000,
    utilizationRate: 42,
    organizationId: 'org2',
    organizationName: 'Harvest Partners Ltd',
  },
  {
    address: '0x567890abcdef1234567890abcdef123456789012',
    name: 'AgroSecure Pool',
    symbol: 'ASPOOL',
    poolType: 'PRIVATE',
    poolValue: 950000,
    utilizationRate: 35,
    organizationId: 'org3',
    organizationName: 'AgroSecure Insurance',
  },
  {
    address: '0x890abcdef1234567890abcdef12345678901234',
    name: 'Africa Public Pool',
    symbol: 'AFPOOL',
    poolType: 'PUBLIC',
    poolValue: 5000000,
    utilizationRate: 28,
  },
];

// Mock Pool Counts
export const mockPoolCounts: PoolCounts = {
  total: 4,
  public: 1,
  private: 3,
  mutual: 0,
};

// Mock Treasury Stats
export const mockTreasuryStats: TreasuryStats = {
  balance: 500000,
  totalPremiums: 7600000,
  totalPayouts: 3350000,
  accumulatedFees: 380000,
  platformFeePercent: 5,
  reserveRatio: 150,
  requiredReserve: 50250,
  availableForPayouts: 449750,
  meetsReserve: true,
  paused: false,
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

// Mock Organization Applications (KYB)
export const mockOrgApplications: OrganizationApplication[] = [
  {
    id: 'app1',
    name: 'Sunrise Farmers Cooperative',
    registrationNumber: 'CPV-2024-001234',
    type: 'COOPERATIVE',
    contactFirstName: 'James',
    contactLastName: 'Mwangi',
    contactEmail: 'james.mwangi@sunrise.co.ke',
    contactPhone: '+254711223344',
    status: 'PENDING_REVIEW',
    kybVerification: {
      id: 'kyb1',
      applicationId: 'app1',
      status: 'PENDING_REVIEW',
      documents: [
        {
          id: 'doc1',
          applicationId: 'app1',
          type: 'BUSINESS_REGISTRATION_CERT',
          fileName: 'sunrise_business_reg.pdf',
          fileUrl: '/uploads/sunrise_business_reg.pdf',
          fileSize: 1024000,
          uploadedAt: '2025-01-25T10:00:00Z',
        },
        {
          id: 'doc2',
          applicationId: 'app1',
          type: 'TAX_PIN_CERT',
          fileName: 'sunrise_tax_pin.pdf',
          fileUrl: '/uploads/sunrise_tax_pin.pdf',
          fileSize: 512000,
          uploadedAt: '2025-01-25T10:05:00Z',
        },
      ],
      submittedAt: '2025-01-25T10:10:00Z',
    },
    createdAt: '2025-01-25T10:00:00Z',
    updatedAt: '2025-01-25T10:10:00Z',
  },
  {
    id: 'app2',
    name: 'Kilimo Partners Ltd',
    registrationNumber: 'NGO-2024-005678',
    type: 'NGO',
    contactFirstName: 'Sarah',
    contactLastName: 'Odhiambo',
    contactEmail: 'sarah@kilimo.co.ke',
    contactPhone: '+254722334455',
    status: 'PENDING_REVIEW',
    kybVerification: {
      id: 'kyb2',
      applicationId: 'app2',
      status: 'PENDING_REVIEW',
      documents: [
        {
          id: 'doc3',
          applicationId: 'app2',
          type: 'BUSINESS_REGISTRATION_CERT',
          fileName: 'kilimo_registration.pdf',
          fileUrl: '/uploads/kilimo_registration.pdf',
          fileSize: 890000,
          uploadedAt: '2025-01-26T14:00:00Z',
        },
        {
          id: 'doc4',
          applicationId: 'app2',
          type: 'TAX_PIN_CERT',
          fileName: 'kilimo_kra.pdf',
          fileUrl: '/uploads/kilimo_kra.pdf',
          fileSize: 450000,
          uploadedAt: '2025-01-26T14:05:00Z',
        },
      ],
      submittedAt: '2025-01-26T14:10:00Z',
    },
    createdAt: '2025-01-26T14:00:00Z',
    updatedAt: '2025-01-26T14:10:00Z',
  },
  {
    id: 'app3',
    name: 'Shamba Insurance Co',
    registrationNumber: 'INS-2024-009012',
    type: 'INSURANCE_COMPANY',
    contactFirstName: 'Michael',
    contactLastName: 'Kimani',
    contactEmail: 'michael@shambainsure.co.ke',
    contactPhone: '+254733445566',
    status: 'APPROVED',
    kybVerification: {
      id: 'kyb3',
      applicationId: 'app3',
      status: 'VERIFIED',
      documents: [
        {
          id: 'doc5',
          applicationId: 'app3',
          type: 'BUSINESS_REGISTRATION_CERT',
          fileName: 'shamba_reg.pdf',
          fileUrl: '/uploads/shamba_reg.pdf',
          fileSize: 1200000,
          uploadedAt: '2025-01-20T09:00:00Z',
          verifiedAt: '2025-01-21T11:00:00Z',
          verifiedBy: 'u1',
        },
        {
          id: 'doc6',
          applicationId: 'app3',
          type: 'TAX_PIN_CERT',
          fileName: 'shamba_tax.pdf',
          fileUrl: '/uploads/shamba_tax.pdf',
          fileSize: 600000,
          uploadedAt: '2025-01-20T09:05:00Z',
          verifiedAt: '2025-01-21T11:00:00Z',
          verifiedBy: 'u1',
        },
      ],
      reviewNotes: 'All documents verified. Business is registered and in good standing.',
      reviewedBy: 'u1',
      reviewedAt: '2025-01-21T11:00:00Z',
      submittedAt: '2025-01-20T09:10:00Z',
    },
    createdAt: '2025-01-20T09:00:00Z',
    updatedAt: '2025-01-21T11:00:00Z',
  },
];

// Mock Organization Admin Invitations
export const mockOrgInvitations: OrgAdminInvitation[] = [
  {
    id: 'inv1',
    organizationId: 'org1',
    organizationName: 'Green Fields Cooperative',
    email: 'newadmin@greenfields.co.ke',
    firstName: 'Alice',
    lastName: 'Wambui',
    status: 'SENT',
    token: 'tok_abc123def456',
    tokenExpiresAt: '2025-02-03T00:00:00Z',
    sentAt: '2025-01-27T09:00:00Z',
    createdAt: '2025-01-27T09:00:00Z',
  },
  {
    id: 'inv2',
    organizationId: 'org2',
    organizationName: 'Harvest Partners Ltd',
    email: 'admin@harvestpartners.co.ke',
    firstName: 'Brian',
    lastName: 'Otieno',
    status: 'ACCEPTED',
    token: 'tok_xyz789uvw012',
    tokenExpiresAt: '2025-01-20T00:00:00Z',
    sentAt: '2025-01-13T14:00:00Z',
    acceptedAt: '2025-01-14T10:30:00Z',
    createdAt: '2025-01-13T14:00:00Z',
  },
  {
    id: 'inv3',
    organizationId: 'org3',
    organizationName: 'AgroSecure Insurance',
    email: 'manager@agrosecure.co.ke',
    firstName: 'Catherine',
    lastName: 'Njeri',
    status: 'PENDING',
    token: 'tok_pending123456',
    tokenExpiresAt: '2025-02-05T00:00:00Z',
    createdAt: '2025-01-28T08:00:00Z',
  },
];

// Helper function to simulate API delay
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Helper to generate invitation token
const generateToken = () => `tok_${Math.random().toString(36).substring(2, 15)}`;

// Mock API functions
export const mockApi = {
  // Auth
  login: async (email: string, password: string) => {
    await delay(500);
    const user = mockUsers.find(u => u.email === email);
    if (!user || !password) {
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

  forgotPassword: async (_email: string) => {
    await delay(500);
    return { message: 'If an account exists with that email, a reset link has been sent' };
  },

  resetPassword: async (_token: string, _password: string) => {
    await delay(500);
    return { message: 'Password reset successful' };
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

  getPoolDetails: async (): Promise<PoolStatus> => {
    await delay(200);
    return mockPoolDetails;
  },

  depositToPool: async (data: { amount: number; minTokensOut?: number }): Promise<PoolDepositResult> => {
    await delay(1000);
    const tokenPrice = mockPoolDetails.tokenPrice;
    const tokensMinted = data.amount / tokenPrice;
    return {
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
      blockNumber: 12345678 + Math.floor(Math.random() * 1000),
      tokensMinted: tokensMinted.toFixed(2),
      tokenPrice: tokenPrice.toFixed(4),
    };
  },

  withdrawFromPool: async (data: { tokenAmount: number; minUsdcOut?: number }): Promise<PoolWithdrawResult> => {
    await delay(1000);
    const tokenPrice = mockPoolDetails.tokenPrice;
    const usdcReceived = data.tokenAmount * tokenPrice;
    return {
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
      blockNumber: 12345678 + Math.floor(Math.random() * 1000),
      usdcReceived: usdcReceived.toFixed(2),
    };
  },

  updatePoolSettings: async (settings: Partial<PoolSettings>): Promise<PoolSettings> => {
    await delay(500);
    if (settings.depositsOpen !== undefined) {
      mockPoolDetails.depositsOpen = settings.depositsOpen;
    }
    if (settings.withdrawalsOpen !== undefined) {
      mockPoolDetails.withdrawalsOpen = settings.withdrawalsOpen;
    }
    return {
      depositsOpen: mockPoolDetails.depositsOpen,
      withdrawalsOpen: mockPoolDetails.withdrawalsOpen,
    };
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
  }) => {
    await delay(2000);
    const poolAddress = '0x' + Math.random().toString(16).substring(2, 42);
    const walletAddress = '0xABC1234567890DEF1234567890ABCDEF12345678';
    const txHash = '0x' + Math.random().toString(16).substring(2, 66);

    // Update mock pool details
    mockPoolDetails.poolAddress = poolAddress;
    mockLiquidityPool.address = poolAddress;

    return {
      organization: {
        ...mockOrganizations[0],
        poolAddress,
        walletAddress,
        privyWalletId: 'wallet_' + Math.random().toString(36).substring(2, 15),
      },
      pool: {
        poolAddress,
        poolId: String(mockPlatformPools.length + 1),
        txHash,
        blockNumber: 12345678 + Math.floor(Math.random() * 1000),
      },
    };
  },

  // Organization Wallet
  // Wallet only exists after pool deployment (created automatically)
  getOrgWallet: async () => {
    await delay(300);
    // Check if pool has been deployed (wallet is created with pool)
    const hasPool = !!mockLiquidityPool.address;
    if (!hasPool) {
      return {
        walletAddress: null,
        walletCreated: false,
        message: 'Deploy a pool to create your organization wallet.',
      };
    }
    return {
      walletAddress: '0xABC1234567890DEF1234567890ABCDEF12345678',
      walletCreated: true,
      balances: {
        usdc: '5000.00',
        eth: '0.00',
      },
    };
  },

  fundWallet: async (_data: { phoneNumber: string; amountKES: number }) => {
    await delay(800);
    return {
      transactionId: `tx_${Math.random().toString(36).substring(2, 15)}`,
      reference: `ref_${Math.random().toString(36).substring(2, 15)}`,
      orderId: `ord_${Math.random().toString(36).substring(2, 10)}`,
      provider: 'pretium',
      status: 'PENDING',
      walletAddress: '0xABC1234567890DEF1234567890ABCDEF12345678',
      instructions: 'Check your phone for M-Pesa prompt',
    };
  },

  // Platform Pools
  getPlatformPools: async (): Promise<{ total: number; pools: PlatformPool[] }> => {
    await delay(300);
    return {
      total: mockPlatformPools.length,
      pools: mockPlatformPools,
    };
  },

  getPlatformPoolCounts: async (): Promise<PoolCounts> => {
    await delay(200);
    return mockPoolCounts;
  },

  // Treasury
  getTreasuryStats: async (): Promise<TreasuryStats> => {
    await delay(300);
    return mockTreasuryStats;
  },

  // Deploy Pool
  deployPoolForOrg: async (orgId: string, data: DeployPoolRequest): Promise<DeployPoolResult> => {
    await delay(1500);
    const poolAddress = '0x' + Math.random().toString(16).substring(2, 42);
    const txHash = '0x' + Math.random().toString(16).substring(2, 66);

    // Add the new pool to mock data
    const org = mockOrganizations.find(o => o.id === orgId);
    const newPool: PlatformPool = {
      address: poolAddress,
      name: data.name,
      symbol: data.symbol,
      poolType: data.poolType,
      poolValue: 0,
      utilizationRate: 0,
      organizationId: orgId,
      organizationName: org?.name,
    };
    mockPlatformPools.push(newPool);
    mockPoolCounts.total += 1;
    if (data.poolType === 'PUBLIC') mockPoolCounts.public += 1;
    else if (data.poolType === 'PRIVATE') mockPoolCounts.private += 1;
    else mockPoolCounts.mutual += 1;

    // Update org with pool address
    if (org) {
      org.poolAddress = poolAddress;
      org.onboardingStep = 'POOL_DEPLOYED';
    }

    return {
      poolAddress,
      txHash,
      blockNumber: 12345678 + Math.floor(Math.random() * 1000),
    };
  },

  createPublicPool: async (data: Omit<DeployPoolRequest, 'poolType' | 'minDeposit' | 'maxDeposit' | 'poolOwner'>): Promise<DeployPoolResult> => {
    await delay(1500);
    const poolAddress = '0x' + Math.random().toString(16).substring(2, 42);
    const txHash = '0x' + Math.random().toString(16).substring(2, 66);

    // Add the new pool to mock data
    const newPool: PlatformPool = {
      address: poolAddress,
      name: data.name,
      symbol: data.symbol,
      poolType: 'PUBLIC',
      poolValue: 0,
      utilizationRate: 0,
    };
    mockPlatformPools.push(newPool);
    mockPoolCounts.total += 1;
    mockPoolCounts.public += 1;

    return {
      poolAddress,
      txHash,
      blockNumber: 12345678 + Math.floor(Math.random() * 1000),
    };
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

  // KYB & Organization Application APIs
  submitOrgApplication: async (data: {
    name: string;
    registrationNumber?: string;
    type: OrganizationType;
    contactFirstName: string;
    contactLastName: string;
    contactEmail: string;
    contactPhone: string;
    documents: { type: 'BUSINESS_REGISTRATION_CERT' | 'TAX_PIN_CERT'; fileName: string; fileSize: number }[];
  }) => {
    await delay(800);
    const appId = generateId();
    const now = new Date().toISOString();

    const documents: KYBDocument[] = data.documents.map((doc, idx) => ({
      id: generateId(),
      applicationId: appId,
      type: doc.type,
      fileName: doc.fileName,
      fileUrl: `/uploads/${doc.fileName}`,
      fileSize: doc.fileSize,
      uploadedAt: now,
    }));

    const application: OrganizationApplication = {
      id: appId,
      name: data.name,
      registrationNumber: data.registrationNumber || 'MOCK-REG-' + appId,
      type: data.type,
      contactFirstName: data.contactFirstName,
      contactLastName: data.contactLastName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      status: 'PENDING_REVIEW',
      kybVerification: {
        id: generateId(),
        applicationId: appId,
        status: 'PENDING_REVIEW',
        documents,
        submittedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };

    mockOrgApplications.push(application);
    return application;
  },

  getOrgApplications: async (status?: ApplicationStatus) => {
    await delay(300);
    const filtered = status
      ? mockOrgApplications.filter(app => app.status === status)
      : mockOrgApplications;
    return { data: filtered, total: filtered.length };
  },

  getOrgApplication: async (id: string) => {
    await delay(200);
    return mockOrgApplications.find(app => app.id === id);
  },

  verifyKYB: async (applicationId: string, verification: { status: 'APPROVED' | 'VERIFIED' | 'REJECTED'; reviewNotes?: string }) => {
    await delay(500);
    const appIndex = mockOrgApplications.findIndex(app => app.id === applicationId);
    if (appIndex === -1) {
      throw new Error('Application not found');
    }

    const now = new Date().toISOString();
    const app = mockOrgApplications[appIndex];

    // Update KYB verification
    // Map 'APPROVED' to 'VERIFIED' for KYBVerification status (backend compatibility)
    const kybStatus = verification.status === 'APPROVED' ? 'VERIFIED' : verification.status;
    app.kybVerification!.status = kybStatus;
    app.kybVerification!.reviewNotes = verification.reviewNotes;
    app.kybVerification!.reviewedBy = 'u1';
    app.kybVerification!.reviewedAt = now;

    // Update application status
    const isApproved = verification.status === 'VERIFIED' || verification.status === 'APPROVED';
    app.status = isApproved ? 'APPROVED' : 'REJECTED';
    app.updatedAt = now;

    // Verify all documents
    app.kybVerification!.documents.forEach(doc => {
      doc.verifiedAt = now;
      doc.verifiedBy = 'u1';
    });

    // If approved, create the organization
    if (isApproved) {
      const newOrg: Organization = {
        id: generateId(),
        name: app.name,
        type: app.type,
        isActive: false,
        onboardingStep: 'REGISTERED',
        farmersCount: 0,
        policiesCount: 0,
        payoutsCount: 0,
        usersCount: 0,
        createdAt: now,
        kybStatus: 'VERIFIED',
        kybVerificationId: app.kybVerification.id,
        contactEmail: app.contactEmail,
        contactPhone: app.contactPhone,
        contactPersonName: `${app.contactFirstName} ${app.contactLastName}`,
      };
      mockOrganizations.push(newOrg);
      return { application: app, organization: newOrg };
    }

    return { application: app };
  },

  adminCreateOrganization: async (data: {
    name: string;
    registrationNumber?: string;
    type: OrganizationType;
    contactFirstName: string;
    contactLastName: string;
    contactEmail: string;
    contactPhone: string;
    verifyImmediately?: boolean;
  }) => {
    await delay(500);
    const now = new Date().toISOString();

    const newOrg: Organization = {
      id: generateId(),
      name: data.name,
      type: data.type,
      isActive: false,
      onboardingStep: 'REGISTERED',
      farmersCount: 0,
      policiesCount: 0,
      payoutsCount: 0,
      usersCount: 0,
      createdAt: now,
      kybStatus: data.verifyImmediately ? 'VERIFIED' : 'PENDING_REVIEW',
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      contactPersonName: `${data.contactFirstName} ${data.contactLastName}`,
    };

    mockOrganizations.push(newOrg);
    return newOrg;
  },

  // Invitation APIs
  createOrgAdminInvitation: async (data: {
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
  }) => {
    await delay(300);
    const org = mockOrganizations.find(o => o.id === data.organizationId);
    if (!org) {
      throw new Error('Organization not found');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation: OrgAdminInvitation = {
      id: generateId(),
      organizationId: data.organizationId,
      organizationName: org.name,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      status: 'PENDING',
      token: generateToken(),
      tokenExpiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    };

    mockOrgInvitations.push(invitation);
    return invitation;
  },

  sendOrgAdminInvitation: async (invitationId: string) => {
    await delay(500);
    const invIndex = mockOrgInvitations.findIndex(inv => inv.id === invitationId);
    if (invIndex === -1) {
      throw new Error('Invitation not found');
    }

    const now = new Date().toISOString();
    mockOrgInvitations[invIndex].status = 'SENT';
    mockOrgInvitations[invIndex].sentAt = now;

    // Mock email sending
    console.log('--- MOCK EMAIL SENT ---');
    console.log(`To: ${mockOrgInvitations[invIndex].email}`);
    console.log(`Subject: You've been invited to join ${mockOrgInvitations[invIndex].organizationName} on MicroCrop`);
    console.log(`Accept invitation link: /accept-invitation/${mockOrgInvitations[invIndex].token}`);
    console.log('------------------------');

    return mockOrgInvitations[invIndex];
  },

  getOrgInvitations: async (organizationId?: string) => {
    await delay(300);
    const filtered = organizationId
      ? mockOrgInvitations.filter(inv => inv.organizationId === organizationId)
      : mockOrgInvitations;
    return { data: filtered, total: filtered.length };
  },

  getInvitation: async (id: string) => {
    await delay(200);
    return mockOrgInvitations.find(inv => inv.id === id);
  },

  validateInvitationToken: async (token: string) => {
    await delay(200);
    const invitation = mockOrgInvitations.find(inv => inv.token === token);

    if (!invitation) {
      return { valid: false, error: 'Invitation not found' };
    }

    if (invitation.status === 'ACCEPTED') {
      return { valid: false, error: 'Invitation has already been accepted' };
    }

    if (invitation.status === 'EXPIRED' || new Date(invitation.tokenExpiresAt) < new Date()) {
      return { valid: false, error: 'Invitation has expired' };
    }

    return { valid: true, invitation };
  },

  acceptInvitation: async (token: string, password: string) => {
    await delay(500);
    const invIndex = mockOrgInvitations.findIndex(inv => inv.token === token);

    if (invIndex === -1) {
      throw new Error('Invitation not found');
    }

    const invitation = mockOrgInvitations[invIndex];

    if (invitation.status === 'ACCEPTED') {
      throw new Error('Invitation has already been accepted');
    }

    if (new Date(invitation.tokenExpiresAt) < new Date()) {
      throw new Error('Invitation has expired');
    }

    const now = new Date().toISOString();

    // Create the user
    const newUser: User = {
      id: generateId(),
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      phone: undefined,
      role: 'ORG_ADMIN',
      organizationId: invitation.organizationId,
      isActive: true,
      createdAt: now,
    };

    mockUsers.push(newUser);

    // Update invitation
    mockOrgInvitations[invIndex].status = 'ACCEPTED';
    mockOrgInvitations[invIndex].acceptedAt = now;

    // Update organization user count
    const orgIndex = mockOrganizations.findIndex(o => o.id === invitation.organizationId);
    if (orgIndex !== -1) {
      mockOrganizations[orgIndex].usersCount += 1;
    }

    console.log('--- USER CREATED ---');
    console.log(`Email: ${newUser.email}`);
    console.log(`Password: ${password} (stored securely in real app)`);
    console.log('--------------------');

    return { user: newUser, invitation: mockOrgInvitations[invIndex] };
  },

  // Get pending KYB count for badge
  getPendingKYBCount: async () => {
    await delay(100);
    return mockOrgApplications.filter(app => app.status === 'PENDING_REVIEW').length;
  },
};
