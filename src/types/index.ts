// User & Auth Types
export type UserRole = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'ORG_STAFF';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  organizationId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Organization Types
export type OrganizationType = 'COOPERATIVE' | 'NGO' | 'MFI' | 'INSURANCE_COMPANY' | 'GOVERNMENT' | 'OTHER';
export type OnboardingStep = 'REGISTERED' | 'CONFIGURED' | 'POOL_DEPLOYED' | 'FUNDED' | 'STAFF_INVITED' | 'ACTIVATED';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  isActive: boolean;
  poolAddress?: string;
  walletAddress?: string;
  privyWalletId?: string;
  onboardingStep: OnboardingStep;
  farmersCount: number;
  policiesCount: number;
  payoutsCount: number;
  usersCount: number;
  createdAt: string;
  // KYB fields
  kybStatus?: KYBStatus;
  kybVerificationId?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPersonName?: string;
}

// KYB (Know Your Business) Types
export type KYBStatus = 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
export type KYBDocumentType = 'BUSINESS_REGISTRATION_CERT' | 'TAX_PIN_CERT';
export type InvitationStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'EXPIRED';
export type ApplicationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface KYBDocument {
  id: string;
  organizationId?: string;
  applicationId?: string;
  type: KYBDocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface KYBVerification {
  id: string;
  organizationId?: string;
  applicationId?: string;
  status: KYBStatus;
  documents: KYBDocument[];
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
}

export interface OrganizationApplication {
  id: string;
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
  // Document URLs (returned by backend after upload)
  businessRegistrationCertUrl?: string;
  businessRegistrationCertName?: string;
  taxPinCertUrl?: string;
  taxPinCertName?: string;
  // KYB verification (may be null if no documents uploaded)
  kybVerification?: KYBVerification | null;
  rejectionReason?: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrgAdminInvitation {
  id: string;
  organizationId: string;
  organizationName?: string;
  email: string;
  firstName: string;
  lastName: string;
  status: InvitationStatus;
  token: string;
  tokenExpiresAt: string;
  sentAt?: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface OrganizationStats {
  totalFarmers: number;
  activePolicies: number;
  totalPremiums: number;
  totalPayouts: number;
  totalFees: number;
  lossRatio: number;
}

// Farmer Types
export type KYCStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Farmer {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  phone: string;
  nationalId: string;
  county: string;
  kycStatus: KYCStatus;
  kycRejectionReason?: string;
  plotsCount: number;
  policiesCount: number;
  createdAt: string;
}

// Plot Types
export interface Plot {
  id: string;
  farmerId: string;
  farmerName: string;
  name: string;
  latitude: number;
  longitude: number;
  acreage: number;
  cropType: string;
  policiesCount: number;
  latestNdvi?: number;
  latestTemperature?: number;
  latestRainfall?: number;
  createdAt: string;
}

// Policy Types
export type PolicyStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'CLAIMED';
export type CoverageType = 'DROUGHT' | 'FLOOD' | 'BOTH';

export interface Policy {
  id: string;
  policyNumber: string;
  organizationId: string;
  farmerId: string;
  farmerName: string;
  plotId: string;
  plotName: string;
  status: PolicyStatus;
  coverageType: CoverageType;
  cropType: string;
  sumInsured: number;
  premium: number;
  platformFee: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface PolicyQuote {
  sumInsured: number;
  coverageType: CoverageType;
  durationDays: number;
  premium: number;
  platformFee: number;
  totalCost: number;
  riskScore: number;
}

// Payout Types
export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Payout {
  id: string;
  policyId: string;
  policyNumber: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  amount: number;
  status: PayoutStatus;
  failureReason?: string;
  transactionHash?: string;
  processedAt?: string;
  createdAt: string;
}

// Damage Assessment Types
export interface DamageAssessment {
  id: string;
  policyId: string;
  policyNumber: string;
  plotId: string;
  plotName: string;
  latitude: number;
  longitude: number;
  weatherDamageScore: number;
  satelliteDamageScore: number;
  combinedDamageScore: number;
  isTriggered: boolean;
  assessmentDate: string;
  createdAt: string;
}

// Financial Types
export interface FinancialSummary {
  totalPremiums: number;
  totalPayouts: number;
  totalFees: number;
  lossRatio: number;
  avgPremium: number;
  policyCount: number;
}

// Liquidity Pool Types
export interface LiquidityPool {
  address: string;
  balance: number;
  utilizationRate: number;
  capitalDeposited: number;
  premiumsReceived: number;
  payoutsSent: number;
  feesPaid: number;
  availableForWithdrawal: number;
}

// Enhanced Pool Status (from API)
export type PoolType = 'PUBLIC' | 'PRIVATE' | 'MUTUAL';

export interface PoolStatus {
  poolAddress: string;
  poolValue: number;
  totalSupply: number;
  tokenPrice: number;
  totalPremiums: number;
  totalPayouts: number;
  activeExposure: number;
  minDeposit: number;
  maxDeposit: number;
  targetCapital: number;
  maxCapital: number;
  depositsOpen: boolean;
  withdrawalsOpen: boolean;
  paused: boolean;
  utilizationRate: number;
}

export interface PoolDepositResult {
  txHash: string;
  blockNumber: number;
  tokensMinted: string;
  tokenPrice: string;
}

export interface PoolWithdrawResult {
  txHash: string;
  blockNumber: number;
  usdcReceived: string;
}

export interface PoolSettings {
  depositsOpen: boolean;
  withdrawalsOpen: boolean;
}

// Organization Wallet
export interface OrgWallet {
  walletAddress: string | null;
  walletCreated: boolean;
  balances?: {
    usdc: string;
    eth: string;
  };
  message?: string;
}

export interface WalletFundResult {
  transactionId: string;
  reference: string;
  orderId: string;
  provider: string;
  status: string;
  walletAddress: string;
  instructions: string;
}

// Platform Pool (for admin overview)
export interface PlatformPool {
  address: string;
  name: string;
  symbol: string;
  poolType: PoolType;
  poolValue: number;
  utilizationRate: number;
  organizationId?: string;
  organizationName?: string;
}

export interface PoolCounts {
  total: number;
  public: number;
  private: number;
  mutual: number;
}

// Pool Deployment Types
export type PoolCoverageType = 'DROUGHT' | 'FLOOD' | 'PEST' | 'DISEASE' | 'COMPREHENSIVE';

export interface DeployPoolRequest {
  name: string;
  symbol: string;
  poolType: PoolType;
  coverageType: PoolCoverageType;
  region: string;
  minDeposit: number;
  maxDeposit: number;
  targetCapital: number;
  maxCapital: number;
  poolOwner?: string;
}

export interface DeployPoolResult {
  poolAddress: string;
  txHash: string;
  blockNumber: number;
}

// Treasury Types
export interface TreasuryStats {
  balance: number;
  totalPremiums: number;
  totalPayouts: number;
  accumulatedFees: number;
  platformFeePercent: number;
  reserveRatio: number;
  requiredReserve: number;
  availableForPayouts: number;
  meetsReserve: boolean;
  paused: boolean;
}

// Activity Types
export type ActivityType = 
  | 'FARMER_REGISTERED'
  | 'FARMER_KYC_UPDATED'
  | 'PLOT_CREATED'
  | 'POLICY_CREATED'
  | 'POLICY_ACTIVATED'
  | 'POLICY_CANCELLED'
  | 'PAYOUT_INITIATED'
  | 'PAYOUT_COMPLETED'
  | 'PAYOUT_FAILED'
  | 'STAFF_INVITED'
  | 'STAFF_ACTIVATED'
  | 'ORG_CREATED'
  | 'ORG_ACTIVATED';

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  metadata?: Record<string, unknown>;
  organizationId?: string;
  userId?: string;
  createdAt: string;
}

// Analytics Types
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface CategoryDataPoint {
  name: string;
  value: number;
  count?: number;
}

export interface RevenueAnalytics {
  totalFees: number;
  totalPremiums: number;
  totalPayouts: number;
  netRevenue: number;
  timeSeries: {
    date: string;
    fees: number;
    premiums: number;
    payouts: number;
  }[];
  byOrganization: CategoryDataPoint[];
}

export interface PoliciesAnalytics {
  totalPolicies: number;
  activePolicies: number;
  claimsRatio: number;
  timeSeries: TimeSeriesDataPoint[];
  byStatus: CategoryDataPoint[];
  byCoverage: CategoryDataPoint[];
}

export interface FarmersAnalytics {
  totalFarmers: number;
  newFarmers: number;
  timeSeries: TimeSeriesDataPoint[];
  byKycStatus: CategoryDataPoint[];
  byCounty: CategoryDataPoint[];
}

export interface PayoutsAnalytics {
  totalAmount: number;
  avgAmount: number;
  count: number;
  successRate: number;
  timeSeries: {
    date: string;
    amount: number;
    count: number;
  }[];
  byStatus: CategoryDataPoint[];
}

export interface DamageAnalytics {
  avgWeatherScore: number;
  avgSatelliteScore: number;
  avgCombinedScore: number;
  triggerRate: number;
  assessments: DamageAssessment[];
  totalCount: number;
}

// Platform Stats
export interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalFarmers: number;
  activePolicies: number;
  newPoliciesPeriod: number;
  totalRevenue: number;
  premiumsCollected: number;
  payoutsSent: number;
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

// Filter Types
export interface DateRange {
  from: Date;
  to: Date;
}

export type Granularity = 'daily' | 'weekly' | 'monthly';
