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
  // Author profile (used when authoring blog posts)
  bio?: string;
  avatarUrl?: string;
  displayRole?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Organization Types
export type OrganizationType = 'COOPERATIVE' | 'NGO' | 'MFI' | 'INSURANCE_COMPANY' | 'GOVERNMENT' | 'OTHER';
// Per-org treasury (v3): the org funds an on-chain reserve (RESERVE_FUNDED) instead of deploying a pool.
export type OnboardingStep = 'REGISTERED' | 'CONFIGURED' | 'WALLET_PROVISIONED' | 'RESERVE_FUNDED' | 'STAFF_INVITED' | 'ACTIVATED';

/** Per-org treasury reserve status (GET /me/reserve). All amounts are USDC. */
export interface ReserveStatus {
  walletAddress: string | null;
  reserve: string; // base units (6dp), as string
  required: string;
  headroom: string;
  reserveUsdc: number;
  requiredUsdc: number;
  headroomUsdc: number;
  solvent: boolean;
}

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
  // Set by the verify endpoint when an application is approved and an org is created.
  organization?: Organization;
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
export type CoverageType = 'DROUGHT' | 'FLOOD' | 'BOTH' | 'COMPREHENSIVE';

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
export type Granularity = 'daily' | 'weekly' | 'monthly';

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

// Payment Types
export type PaymentType = 'PREMIUM' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface Payment {
  id: string;
  policyId?: string;
  farmerId?: string;
  organizationId?: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  mpesaRef?: string;
  transactionHash?: string;
  createdAt: string;
}

// Treasury Amount Types
export interface TreasuryPremiumAmounts {
  total: string;
  byOrganization: { organizationId: string; organizationName: string; amount: string }[];
}

export interface TreasuryPayoutAmounts {
  total: string;
  byOrganization: { organizationId: string; organizationName: string; amount: string }[];
}

// Policy Expire Check
export interface PolicyExpireCheck {
  policyId: string;
  isExpired: boolean;
  expiresAt: string;
  daysRemaining: number;
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

// Satellite Monitoring Types
export type HealthStatus = 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'POOR' | 'CRITICAL' | 'UNKNOWN';
export type FraudFlagType = 'NDVI_MISMATCH' | 'BOUNDARY_OVERLAP' | 'SUSPICIOUS_TIMING' | 'HISTORICAL_ANOMALY';
export type FraudSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FraudFlagStatus = 'OPEN' | 'INVESTIGATING' | 'CONFIRMED_FRAUD' | 'CLEARED' | 'DISMISSED' | 'RESOLVED_FALSE_POSITIVE' | 'RESOLVED_CONFIRMED' | 'RESOLVED_INCONCLUSIVE';
export type DamageVerdict = 'CONSISTENT' | 'SUSPICIOUS' | 'INCONSISTENT';

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface PlotBoundary {
  plotId: string;
  name: string;
  boundary: GeoJsonPolygon;
  centroidLat: number;
  centroidLon: number;
  areaHectares: number;
}

export interface NdviReading {
  id: string;
  plotId: string;
  captureDate: string;
  ndvi: number;
  ndviMin: number;
  ndviMax: number;
  ndviStdDev: number;
  cloudCover: number;
  sampleCount: number;
  source: string;
}

export interface PlotHealth {
  plotId: string;
  ndvi: number;
  health: HealthStatus;
  deviation: number;
  isAnomaly: boolean;
  captureDate: string;
  source: string;
  baseline: {
    mean: number;
    stdDev: number;
    yearsIncluded: number;
  };
}

export interface SatelliteMonitoringOverview {
  totalPlots: number;
  healthDistribution: Record<HealthStatus, number>;
  averageNdvi: number;
  recentAnomalies: number;
}

export interface DamageVerification {
  assessment: {
    id: string;
    damagePercent: number;
    source: string;
  };
  onChainClaim: {
    damagePercent: number;
    txHash: string;
  };
  satelliteEvidence: {
    ndvi: number;
    satelliteDamage: number;
  };
  historicalBaseline: {
    mean: number;
    stdDev: number;
  };
  verdict: DamageVerdict;
}

export interface FraudFlag {
  id: string;
  type: FraudFlagType;
  severity: FraudSeverity;
  status: FraudFlagStatus;
  plotId?: string;
  policyId?: string;
  description?: string;
  resolution?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FraudSummary {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
}

// Field Onboarding Types
export interface GpsPoint {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: string;
}

export interface GpsTrackResponse {
  plot: {
    id: string;
    boundary: GeoJsonPolygon;
    centroidLat: number;
    centroidLon: number;
    areaHectares: number;
  };
  metadata: {
    totalPointsReceived: number;
    pointsFilteredOut: number;
    finalVertices: number;
    accuracyThreshold: number;
    avgAccuracy: number;
  };
  overlaps: { plotId: string; plotName: string; overlapArea: number }[];
  overlapWarning: string | null;
}

export interface KycFieldVerifyResponse {
  id: string;
  kycStatus: 'APPROVED';
  kycApprovedBy: string;
  kycApprovedAt: string;
}

export interface PaymentInitiateResponse {
  reference: string;
  status: string;
  message: string;
}

export interface PaymentStatusResponse {
  reference: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  policyId?: string;
  message?: string;
}

// Blog Types
export type PostStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'UNPUBLISHED';

export interface BlogAuthor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatarUrl?: string;
  displayRole?: string;
  bio?: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  postCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  postCount?: number;
  createdAt?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: PostStatus;
  coverImageUrl?: string | null;
  coverImagePath?: string | null;
  coverImageAlt?: string | null;
  coverImageWidth?: number | null;
  coverImageHeight?: number | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  ogImagePath?: string | null;
  category?: BlogCategory | null;
  categoryId?: string | null;
  tags?: BlogTag[];
  author?: BlogAuthor | null;
  authorId?: string;
  readingTimeMinutes?: number;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Livestock Types
export type LivestockType = 'CATTLE' | 'GOAT' | 'SHEEP' | 'CAMEL' | 'POULTRY';
export type IBLISeason = 'LRLD' | 'SRSD';
export type InsuranceProduct = 'CROP' | 'LIVESTOCK';

export interface Herd {
  id: string;
  farmerId: string;
  farmerName?: string;
  organizationId: string;
  name: string;
  livestockType: LivestockType;
  headCount: number;
  estimatedValue: number;
  tluCount: number;
  insuranceUnitId?: string;
  insuranceUnit?: InsuranceUnit;
  latitude?: number;
  longitude?: number;
  policiesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceUnit {
  id: string;
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
  valuePerTLU: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LivestockPolicyQuote {
  tluCount: number;
  season: IBLISeason;
  premiumPerTLU: number;
  premium: number;
  platformFee: number;
  totalCost: number;
  sumInsured: number;
  insuranceUnitCode: string;
}

export interface UploadResult {
  path: string;
  url: string;
  mimeType: string;
  size: number;
}
