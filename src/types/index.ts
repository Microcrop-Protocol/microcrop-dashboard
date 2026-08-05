/**
 * A numeric value delivered as a STRING over JSON because it maps to a Prisma
 * `Decimal` column (Prisma serializes Decimal to a string). Always coerce with
 * Number() before arithmetic, .toFixed(), or .toLocaleString().
 */
export type DecimalString = string;

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
// Onboarding lifecycle emitted by the backend (application.service / kyb.service / invitation.service).
// POOL_DEPLOYMENT is the legacy enum name for the wallet & reserve setup phase.
export type OnboardingStep = 'APPLICATION' | 'KYB_VERIFICATION' | 'POOL_DEPLOYMENT' | 'ADMIN_SETUP' | 'COMPLETED';

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
export type KYBStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';
// KYBDocument.documentType enum (schema.prisma). Matches the values the API stores/returns.
export type KYBDocumentType =
  | 'BUSINESS_REGISTRATION'
  | 'TAX_CERTIFICATE'
  | 'DIRECTOR_ID'
  | 'PROOF_OF_ADDRESS'
  | 'BANK_STATEMENT'
  // Kenya-specific
  | 'IRA_LICENSE'
  // Ghana-specific
  | 'CERTIFICATE_OF_INCORPORATION'
  | 'NIC_LICENSE'
  | 'GHANA_TIN'
  | 'OTHER';

// Per-market KYB checklist served by GET /organizations/me/kyb (backend
// buildKybChecklist). Drives which upload slots and license fields the form renders.
export interface KybChecklistItem {
  documentType: KYBDocumentType;
  label: string;
  required: boolean;
  satisfied: boolean;
}
export interface KybChecklist {
  countryCode: string;
  regulator: string; // 'IRA' (KE) / 'NIC' (GH)
  regulatorLicenseRequired: boolean;
  regulatorLicenseDocType: KYBDocumentType | null;
  livestockEnabled?: boolean;
  requiredDocuments: KybChecklistItem[];
  optionalDocuments: KybChecklistItem[];
}
// KYBVerification.status enum (distinct from the org-level KYBStatus).
export type VerificationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'DOCUMENTS_REQUIRED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED';

// Org-attached KYB (self-service signup → in-dashboard verification)
export interface OrgKybDocument {
  id: string;
  documentType: 'BUSINESS_REGISTRATION' | 'TAX_CERTIFICATE' | string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}
export interface OrgKybVerification {
  id: string;
  status: string;
  verifierNotes?: string | null;
  verifiedAt?: string | null;
  documents: OrgKybDocument[];
  // Insurance-regulator operating license (required for KE/IRA and GH/NIC markets).
  regulator?: string | null;
  regulatorLicenseNumber?: string | null;
  licenseExpiresAt?: string | null;
  // Sumsub KYB/AML screening (advisory; RED blocks platform-admin approval).
  sumsubApplicantId?: string | null;
  sumsubReviewStatus?: string | null;
  sumsubReviewAnswer?: 'GREEN' | 'RED' | null;
  sumsubReviewPayload?: { reviewResult?: { rejectLabels?: string[] } } | null;
  sumsubReviewedAt?: string | null;
}
export interface OrgKyb {
  kybStatus: KYBStatus;
  onboardingStep: string;
  countryCode?: string;
  checklist?: KybChecklist;
  verification: OrgKybVerification | null;
}
export interface OrgKybReview {
  id: string;
  name: string;
  type: string;
  registrationNumber: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  county?: string | null;
  kybStatus: KYBStatus;
  createdAt: string;
  kybVerification: OrgKybVerification | null;
}
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
export type ApplicationStatus =
  | 'PENDING_REVIEW'
  | 'UNDER_REVIEW'
  | 'KYB_REQUIRED'
  | 'KYB_IN_PROGRESS'
  | 'KYB_SUBMITTED'
  | 'APPROVED'
  | 'REJECTED';

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
  status: VerificationStatus;
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
  latitude: DecimalString;
  longitude: DecimalString;
  acreage: DecimalString;
  cropType: string;
  policiesCount: number;
  latestNdvi?: number;
  latestTemperature?: number;
  latestRainfall?: number;
  createdAt: string;
}

// Policy Types
export type PolicyStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'CLAIMED';
export type CoverageType =
  | 'DROUGHT'
  | 'FLOOD'
  | 'BOTH'
  | 'COMPREHENSIVE'
  | 'LIVESTOCK_DROUGHT'
  | 'LIVESTOCK_DISEASE'
  | 'LIVESTOCK_COMPREHENSIVE';

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
  sumInsured: DecimalString;
  premium: DecimalString;
  platformFee: DecimalString;
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
  // Optional on-chain settlement determination for this payout. Not yet returned
  // by the dashboard payouts endpoint (see DeterminationStatusBadge) — present only
  // when a determination stream is wired through. UNDERFUNDED means the org reserve
  // could not fully fund the payout.
  determination?: Determination;
  determinationStatus?: DeterminationStatus;
}

// Damage Assessment Types
// Field names match the raw DamageAssessment record the API returns
// (prisma.damageAssessment.findMany in dashboard.org.service.js / dashboard.platform.service.js).
export interface DamageAssessment {
  id: string;
  policyId: string;
  policyNumber: string;
  plotId: string;
  plotName: string;
  latitude: number;
  longitude: number;
  weatherDamage: DecimalString;
  satelliteDamage: DecimalString;
  ndviDamage?: DecimalString;
  combinedDamage: DecimalString;
  triggered: boolean;
  triggerDate: string;
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
  // Settlement determinations grouped by status, e.g. { CONFIRMED: 12, UNDERFUNDED: 3 }.
  byDeterminationStatus?: Record<string, number>;
}

export interface DamageAnalytics {
  avgWeatherScore: number;
  avgSatelliteScore: number;
  avgCombinedScore: number;
  triggerRate: number;
  assessments: DamageAssessment[];
  totalCount: number;
}

// Transaction Types (backend Transaction model — schema.prisma)
export type TransactionType = 'PREMIUM' | 'PAYOUT' | 'REFUND' | 'WALLET_FUNDING';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface Transaction {
  id: string;
  organizationId: string;
  farmerId?: string;
  type: TransactionType;
  amount: DecimalString;
  currency: string;
  status: TransactionStatus;
  policyId?: string;
  payoutId?: string;
  reference: string;
  phoneNumber?: string;
  description?: string;
  externalRef?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
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
  ndvi: DecimalString;
  ndviMin: DecimalString;
  ndviMax: DecimalString;
  ndviStdDev: DecimalString;
  cloudCover: DecimalString;
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
  estimatedValue: DecimalString;
  tluCount: DecimalString;
  insuranceUnitId?: string;
  insuranceUnit?: InsuranceUnit;
  latitude?: DecimalString;
  longitude?: DecimalString;
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
  ndviBaselineLRLD: DecimalString;
  ndviBaselineSRSD: DecimalString;
  strikeLevelLRLD: DecimalString;
  strikeLevelSRSD: DecimalString;
  premiumRateLRLD: DecimalString;
  premiumRateSRSD: DecimalString;
  valuePerTLU: DecimalString;
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

// Livestock peril (backend LivestockPeril enum). Types only — no UI yet.
export type LivestockPeril = 'DROUGHT_PASTURE' | 'DISEASE_OUTBREAK' | 'HEAT_STRESS';

// Determination (per-org treasury settlement determination). Types only — no UI yet.
export type DeterminationStatus =
  | 'RECEIVED'
  | 'SUBMITTING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'UNDERFUNDED';

export interface Determination {
  id: string;
  kind: string; // CROP_DAMAGE | LIVESTOCK_FORAGE | LIVESTOCK_PAYOUT
  schemaVersion: string;
  methodologyVersion: string;
  onChainPolicyId?: string | null;
  unitCode?: string | null;
  damagePercentBp: number;
  payoutAmount?: string | null; // USDC base units (6dp), string to preserve precision
  chainId: number;
  verifyingContract: string;
  status: DeterminationStatus;
  submittedTxHash?: string | null;
  blockNumber?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Forage-failure alert (livestock/IBLI). Shape matches
// GET /api/dashboard/org/forage-alerts (dashboard.org.service.js).
export type ForageAlertStatus = 'TRIGGERED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ForageAlert {
  id: string;
  insuranceUnitId: string;
  season: IBLISeason;
  year: number;
  cumulativeNDVI: DecimalString;
  strikeLevel: DecimalString;
  deficitPercent: DecimalString;
  status: ForageAlertStatus;
  policiesAffected: number;
  totalPayoutUSDC: DecimalString;
  processedAt: string | null;
  createdAt: string;
  insuranceUnit?: {
    county: string;
    unitCode: string;
    country?: string;
  };
}

// Outbound webhook delivery (partner integration). Shape matches
// GET /organizations/me/webhook/deliveries.
export type WebhookDeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED';

export interface WebhookDelivery {
  id: string;
  event: string; // e.g. policy.activated, payout.executed, policy.expired
  url: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Webhook endpoint configuration (GET/PUT /organizations/me/webhook).
export interface WebhookConfig {
  url: string | null;
  secretSet: boolean;
  secret: string | null;
}

// API key status — always masked (GET /organizations/me/api-key).
export interface ApiKeyStatus {
  keyPrefix: string;
  last4: string;
  masked: string;
  active: boolean;
  rotatedAt: string | null;
  createdAt: string;
}

// Plaintext credentials returned exactly once on rotate
// (POST /organizations/me/api-key/rotate).
export interface ApiKeyRotateResult {
  apiKey: string;
  apiSecret: string;
}

// ============================================
// WEATHER STATIONS (WeatherXM Pro)
// ============================================

export interface WeatherStation {
  id: string;
  name: string | null;
  cellId: string | null;
  lat: number | null;
  lon: number | null;
  elevation: number | null;
  /** WeatherXM's own quality-of-data score for yesterday, 0..1. */
  qod: number;
  /** qod >= the backend's threshold. A station can exist and not be usable. */
  usable: boolean;
  dataSince: string | null;
  distanceKm?: number | null;
}

export interface WeatherBounds {
  name?: string;
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export interface WeatherMarket {
  code: string;
  name: string;
  bounds: WeatherBounds;
}

export interface WeatherStationCoverage {
  bounds: WeatherBounds;
  market: string | null;
  summary: { total: number; usable: number; unusable: number; usablePct: number };
  usableThreshold: number;
  stations: WeatherStation[];
}

export interface PlotCoverage {
  plot: { id: string; name: string; lat: number; lon: number };
  assignedStationId: string | null;
  assignedStationStillUsable: boolean | null;
  covered: boolean;
  stationsInRange: number;
  usableInRange: number;
  nearest: WeatherStation | null;
  nearestUsable: WeatherStation | null;
  radiusKm: number;
  stations: WeatherStation[];
}
