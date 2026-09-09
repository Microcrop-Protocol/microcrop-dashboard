/**
 * A numeric value delivered as a STRING over JSON because it maps to a Prisma
 * `Decimal` column (Prisma serializes Decimal to a string). Always coerce with
 * Number() before arithmetic, .toFixed(), or .toLocaleString().
 */
export type DecimalString = string;

// User & Auth Types
export type OrgRole =
  | 'ORG_ADMIN'
  | 'ORG_STAFF'
  | 'ORG_FIELD_AGENT'
  | 'ORG_FINANCE'
  | 'ORG_UNDERWRITER'
  | 'ORG_VIEWER';

export type UserRole = 'PLATFORM_ADMIN' | OrgRole;

/** Mirrors ROLE_LABELS in the backend (microcrop-backend/src/utils/constants.js). */
export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  ORG_ADMIN: 'Administrator',
  ORG_STAFF: 'Staff (legacy)',
  ORG_FIELD_AGENT: 'Field Agent',
  ORG_FINANCE: 'Finance Officer',
  ORG_UNDERWRITER: 'Underwriter',
  ORG_VIEWER: 'Viewer',
};

export const ORG_ROLES = Object.keys(ORG_ROLE_LABELS) as OrgRole[];

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  organizationId?: string;
  isActive: boolean;
  /** Set when the invitee accepts. NULL/absent = invited but not yet accepted (Pending). */
  acceptedAt?: string | null;
  lastLoginAt?: string;
  /** The staff endpoint returns this name; other endpoints use lastLoginAt. */
  lastLogin?: string | null;
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

/**
 * WHAT THE PARTNER BOUGHT. Mirrors the backend Prisma `ServiceTier` enum exactly
 * (microcrop-backend/src/services/entitlement.service.js `SERVICE_TIER`).
 *
 *   DETERMINATION               MicroCrop determines whether the parametric trigger fired and
 *                               issues a signed, independently verifiable determination plus
 *                               its evidence package. The PARTNER settles the farmer
 *                               off-platform, off its own balance sheet. We never touch money.
 *   DETERMINATION_AND_SETTLEMENT  the above, plus MicroCrop originates and settles the payout.
 *
 * This union is deliberately NOT widened with a `| string` escape hatch: an unrecognised value
 * arriving from the server must not typecheck as a tier, so it falls through to the "unknown"
 * branch of `@/lib/tier`, which denies. Never compare against `'DETERMINATION'` to decide
 * whether to hide a settlement feature — see `isSettlementEntitled`.
 */
export type ServiceTier = 'DETERMINATION' | 'DETERMINATION_AND_SETTLEMENT';
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
  /**
   * The tier the organization is on TODAY — mutable, changed only by a platform admin
   * (`POST /platform/organizations/:orgId/service-tier`). `GET /organizations/me` returns the
   * whole org row minus credentials, so this column reaches the dashboard.
   *
   * GATES INTAKE, NEVER DRAIN. Use it to decide what to OFFER (may this org start a settlement
   * flow at all); never to decide what happens to an existing policy — that is
   * `Policy.settlementMode`, frozen at inception. Optional because an older backend, or a
   * cached response, may not carry it: absent means UNKNOWN, not Tier 2 (see `@/lib/tier`).
   */
  serviceTier?: ServiceTier | null;
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
  /**
   * The API field is `phoneNumber` — every farmer endpoint (register, list, get,
   * update) returns the Prisma `Farmer` record verbatim, and that column is
   * `phoneNumber`. Reading `phone` yields `undefined` and renders blank.
   */
  phoneNumber: string;
  /** @deprecated The API never returns `phone`. Read `phoneNumber`. */
  phone?: string;
  nationalId: string;
  county: string;
  kycStatus: KYCStatus;
  /**
   * The API field is `kycRejectedReason` — the Prisma column name, written by
   * `PUT /farmers/:id/kyc` and passed through verbatim. This was typed
   * `kycRejectionReason` here, so the rejection note never rendered on a
   * rejected farmer and the operator could not see why.
   */
  kycRejectedReason?: string;
  /** @deprecated The API never returns `kycRejectionReason`. Read `kycRejectedReason`. */
  kycRejectionReason?: string;
  /**
   * Prisma relation counts, as `GET /farmers` returns them
   * (`include: { _count: { select: { plots, policies } } }`). There are no flat
   * `plotsCount`/`policiesCount` fields — typing them made both farmer-table
   * columns permanently blank.
   *
   * Optional because `GET /farmers/:id` includes the full `plots`/`policies`
   * ARRAYS instead and returns no `_count`. Never assume it is present.
   */
  _count?: {
    plots: number;
    policies: number;
  };
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
  /**
   * On-chain activation artifacts. `GET /policies` and `GET /policies/:id` return the raw
   * Prisma Policy row, so these reach the client. They are ALSO how a sandbox-activated
   * ("test data") policy is recognised — see `@/lib/simulated`:
   *   real       onChainPolicyId is a decimal uint256, txHash is 0x + 64 hex, blockNumber > 0
   *   simulated  both are prefixed "SIMULATED-NO-CHAIN-" and blockNumber is -1
   * Nullable throughout: a PENDING policy has no on-chain state at all. `blockNumber` is a
   * Prisma BigInt, JSON-serialised as a STRING by the backend.
   */
  onChainPolicyId?: string | null;
  txHash?: string | null;
  blockNumber?: string | number | null;
  /**
   * WHO OWES THIS FARMER FOR THIS COVER — frozen at inception, immutable once ACTIVE.
   *
   * A different question from `Organization.serviceTier` (what the org bought TODAY, which is
   * mutable). A tier downgrade must never strand an in-flight payout on cover sold under
   * Tier 2, so every per-policy settlement decision reads THIS field and never the org's.
   * Optional because an older cached payload, or an endpoint that does not select it, may omit
   * it — and an absent value must DENY, never default to "MicroCrop settles it". See
   * `@/lib/tier`.
   */
  settlementMode?: ServiceTier | null;
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

/**
 * What the backend tells the caller to collect once a policy has been created.
 * `amount` is the premium in the policy's currency and is the value that must be
 * passed straight back to `initiatePayment`.
 */
export interface PaymentInstructions {
  amount: number;
  policyNumber: string;
  message: string;
}

/**
 * `POST /policies/purchase` does not return a bare Policy — it returns the created
 * policy alongside the payment instructions needed to collect the premium.
 */
export interface PolicyPurchaseResponse {
  policy: Policy;
  paymentInstructions: PaymentInstructions;
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
  /**
   * M-Pesa settlement receipt, written when the payout completes. A sandbox-settled
   * ("test data") payout carries a "SIMULATED-NO-REAL-MONEY-…" pseudo receipt instead —
   * see `@/lib/simulated`.
   */
  mpesaRef?: string | null;
  /**
   * The parent policy, as included by `GET /payouts` (which selects `policyNumber` and
   * `onChainPolicyId`) and `GET /payouts/:id` (which includes the whole row). Used to
   * recognise a test payout before it has settled, when it has no `mpesaRef` yet.
   */
  policy?: {
    policyNumber?: string;
    onChainPolicyId?: string | null;
    txHash?: string | null;
    blockNumber?: string | number | null;
  } | null;
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

// OrgWallet / WalletFundResult were removed with the non-custodial model: there is no
// per-org platform-provisioned wallet for an insurer to fund. Reserves are held
// off-platform in a segregated trust.

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

/**
 * POST /payments/initiate. Pinned by contracts/api-contract.json
 * (`endpoints["POST /payments/initiate"].response`).
 *
 * MONEY PATH. This once declared a REQUIRED `message` and nothing else but
 * `reference`/`status`. The backend has never returned a `message` — the
 * human-readable line is `instructions` — so any UI rendering it printed
 * `undefined` right after charging a farmer's phone, and `transactionId`,
 * `orderId` and `provider` were invisible to every caller.
 */
export interface PaymentInitiateResponse {
  transactionId: string;
  /** The TRANSACTION reference (a fresh uuid) — NOT the policy id that was sent in. */
  reference: string;
  /**
   * Provider order id. Null on the replay-guard branch when the stored
   * transaction has no order id recorded yet.
   */
  orderId: string | null;
  /** 'PRETIUM' | 'SWYPT' | 'SIMULATED'. Null on the replay-guard branch, as above. */
  provider: string | null;
  status: string;
  instructions: string;
  /**
   * True when a PENDING premium prompt for this policy was still fresh, so the
   * backend returned the EXISTING transaction and sent NO second STK push.
   * Duplicate premium is not refunded anywhere in this system, hence the guard.
   * Absent (not `false`) on the normal path.
   */
  alreadyPending?: boolean;
  /** Sandbox only (SIMULATE_PAYMENTS): no prompt was sent and no money moved. */
  simulated?: boolean;
  /** Sandbox only, accompanies `simulated`. */
  warning?: string;
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

/**
 * The raw determination lifecycle (Prisma `DeterminationStatus`). This is MicroCrop's own
 * processing state for the record, NOT an answer to "was the farmer paid".
 *
 * `DETERMINATION_ONLY` is the terminal state a determination reaches when the policy behind it
 * was sold under Tier 1: MicroCrop determined, signed and anchored it, and then deliberately
 * did not submit anything on chain. It is a SUCCESS, and must never be rendered as a failure —
 * `failureReason` is NULL on it for exactly that reason.
 */
export type DeterminationStatus =
  | 'RECEIVED'
  | 'SUBMITTING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'UNDERFUNDED'
  | 'DETERMINATION_ONLY';

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

// ===========================================================================
// THE PARTNER DETERMINATION VIEW — GET /api/determinations[/:id]
//
// THREE FACTS, NEVER COLLAPSED INTO ONE STATUS. The backend projection
// (determination.service.buildPartnerDeterminationView) returns them as three sibling blocks
// and the UI must keep them apart:
//
//   determined     what MICROCROP determined. Signed, hashed, anchored, re-verifiable.
//   settlement     whether MICROCROP settled — and under Tier 1, that it deliberately did NOT.
//   partnerReport  what the PARTNER claims it did. Always partner-attested, never verified.
//
// Collapsing them is the failure this shape exists to prevent: a single status reading UNPAID
// looks like a broken determination, and one reading PAID launders an unverified partner claim
// into a MicroCrop fact.
//
// CURRENCY NEUTRALITY. Every money figure below is in the POLICY's own currency, as an exact
// integer count of MINOR units (`amountMinor`) plus a human string (`amount`). There is no USDC
// field on a Tier 1 response and there must never be one — the backend runs the whole Tier 1
// projection through a guard that throws on any key ending in `usdc`, on `chainId` and on
// `verifyingContract`. A Tier 1 partner settles in its own currency and must not inherit an FX
// dependency from us.
// ===========================================================================

/**
 * An amount stated in the policy's own currency. `amountMinor` is AUTHORITATIVE — a decimal
 * string of minor units, never a JSON number, because a large KES/GHS figure loses precision as
 * an IEEE-754 double. `amount` is the pre-formatted human string; `exponent` is the ISO 4217
 * minor-unit scale (2 for KES/GHS/USD, 0 for e.g. UGX) and is what a form must use to convert
 * an operator's typed amount back into minor units. Never assume 2.
 */
export interface MoneyMinor {
  amountMinor: string;
  amount: string;
  currency: string;
  exponent: number;
  damagePercentBp: number;
  /** Plain-English statement of how the figure was derived; render it verbatim. */
  basis: string;
}

/** Notary anchor receipt, allow-listed by the backend (never the raw provider blob). */
export interface DeterminationNotary {
  provider?: string;
  network?: string;
  reference?: string;
  txHash?: string;
  ledger?: string | number;
  anchoredAt?: string;
}

/** FACT 1 — what MicroCrop determined. Identical in both tiers. */
export interface DeterminedFact {
  kind: string;
  schemaVersion: string;
  methodologyVersion: string;
  unitCode: string | null;
  triggered: boolean;
  thresholdBp: number | null;
  damagePercentBp: number;
  assessedAt: string | null;
  determinedAt: string | null;
  canonicalHash: string | null;
  signerAddress: string | null;
  notary: DeterminationNotary | null;
  evidence: {
    available: boolean;
    href: string;
    /** False on a legacy EVM-only record: it exports, but cannot be independently re-verified. */
    verifiable: boolean;
  };
}

/**
 * FACT 2, Tier 1 — MicroCrop deliberately did not settle. `status` is `NOT_SETTLED_BY_MICROCROP`
 * when the trigger fired and `NO_PAYOUT_DUE` when it did not; both are correct outcomes, neither
 * is an error. There is NO `onChain` block: a chain reference under a Tier 1 settlement heading
 * would assert something false.
 */
export type Tier1SettlementStatus = 'NOT_SETTLED_BY_MICROCROP' | 'NO_PAYOUT_DUE';

/** FACT 2, Tier 2 — MicroCrop's own settlement lifecycle, derived from the determination. */
export type Tier2SettlementStatus =
  | 'SETTLEMENT_PENDING'
  | 'SETTLEMENT_IN_PROGRESS'
  | 'SETTLEMENT_SUBMITTED_ON_CHAIN'
  | 'SETTLEMENT_BLOCKED_UNDERFUNDED'
  | 'SETTLEMENT_FAILED'
  | 'NOT_SETTLED_BY_MICROCROP';

export type SettlementFactStatus = Tier1SettlementStatus | Tier2SettlementStatus;

/**
 * Served when the derived amount disagrees with the amount inside the SIGNED canonical
 * determination that ships in the evidence package. The backend serves the derived figure and
 * says so; a partner that can see the divergence can stop and reconcile rather than pay the
 * wrong farmer the wrong amount. Rare, and must be rendered loudly when present.
 */
export interface AmountOwedDiscrepancy {
  derivedAmountMinor: string;
  signedAmountMinor: string;
  currency: string;
  servedFigure: string;
  note: string;
}

export interface SettlementFact {
  mode: ServiceTier | null;
  settledByMicrocrop: boolean;
  status: SettlementFactStatus;
  /** Tier 1 only: the plain-English statement of why we did not settle. Render verbatim. */
  reason: string | null;
  /** Null when the policy's currency has no registered minor-unit exponent — never guessed. */
  amountOwed: MoneyMinor | null;
  amountOwedUnavailableReason?: string;
  amountOwedDiscrepancy?: AmountOwedDiscrepancy;
  /** Tier 2 only. */
  failureReason?: string | null;
  /** Tier 2 only — absent entirely under Tier 1, not nulled. */
  onChain?: {
    chainId: number | null;
    verifyingContract: string | null;
    submittedTxHash: string | null;
    blockNumber: string | null;
    payoutAmountUsdc: string | null;
  };
}

/** Prisma `PartnerSettlementOutcome`. */
export type PartnerSettlementOutcome = 'SETTLED_FULL' | 'SETTLED_PARTIAL' | 'DECLINED';

/** Prisma `PartnerSettlementMethod`. */
export type PartnerSettlementMethod =
  | 'MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'ACCOUNT_CREDIT'
  | 'IN_KIND'
  | 'OTHER';

/**
 * The status of FACT 3. A REPORTING state, never a funding state:
 *   NOT_REPORTED             we are waiting and the due date has not passed
 *   OVERDUE                  the reporting window closed with no report — it does NOT mean
 *                            MicroCrop owes anything
 *   REPORTED                 the partner has attested; still unverified
 *   NOT_APPLICABLE           Tier 2 — MicroCrop settled it, there is nothing to attest
 */
export type PartnerReportStatus = 'NOT_REPORTED' | 'OVERDUE' | 'REPORTED' | 'NOT_APPLICABLE';

/**
 * One stored attestation. A report is NEVER edited — a correction is a new row naming the one
 * it supersedes, so the chain IS the audit trail and superseded rows stay visible.
 *
 * `verificationStatus` is a ONE-VALUED enum on the backend. There is no code path anywhere that
 * can express "MicroCrop verified this", so the UI must never offer a control that implies one.
 */
export interface PartnerSettlementReport {
  id: string;
  determinationId: string;
  policyId: string;
  /** The idempotency key, with the determination id. The partner's own M-Pesa/bank reference. */
  partnerReference: string;
  outcome: PartnerSettlementOutcome;
  method: PartnerSettlementMethod;
  settledAmountMinor: string;
  /** Human string, or null when the currency has no registered exponent. */
  settledAmount: string | null;
  settlementCurrency: string;
  settledAt: string | null;
  shortfallReason: string | null;
  declineReason: string | null;
  attestingOfficer: { name: string; title: string; email: string | null };
  evidenceRef: string | null;
  evidenceHash: string | null;
  notes: string | null;
  reportedVia: string;
  reportedAt: string | null;
  verificationStatus: 'UNVERIFIED';
  attestedByPartner: true;
  verifiedByMicrocrop: false;
  supersedesReportId: string | null;
  supersededAt: string | null;
  supersededByReportId: string | null;
}

/** FACT 3 — what the partner says it did. Never merged into `settlement`. */
export interface PartnerReportFact {
  status: PartnerReportStatus;
  attestedByPartner: boolean;
  /** Hardcoded false on the backend, not a column. Never render this as a MicroCrop fact. */
  verifiedByMicrocrop: false;
  /** False below the trigger: nothing is owed, so no report is expected. */
  reportRequired: boolean;
  dueAt: string | null;
  overdue: boolean;
  reportedAt: string | null;
  reference: string | null;
  amount: { amountMinor: string; amount: string | null; currency: string } | null;
  outcome?: PartnerSettlementOutcome;
  method?: PartnerSettlementMethod;
  /** The current (newest un-superseded) attestation. */
  report: PartnerSettlementReport | null;
  /** Newest first, INCLUDING superseded rows — the correction chain is the audit trail. */
  history: PartnerSettlementReport[];
  /** The unverified-attestation disclaimer. Render it verbatim; do not paraphrase. */
  note: string;
}

/** The org-scoped determination, as returned by GET /determinations and /determinations/:id. */
export interface PartnerDetermination {
  id: string;
  policy: {
    id: string;
    policyNumber: string | null;
    sumInsured: DecimalString | null;
    currency: string | null;
    coverageType: CoverageType | null;
    settlementMode: ServiceTier | null;
  } | null;
  determined: DeterminedFact;
  settlement: SettlementFact;
  partnerReport: PartnerReportFact;
}

/** GET /determinations/:id/evidence — the independently verifiable package. */
export interface EvidencePackage {
  packageVersion: string;
  exportedAt: string | null;
  determination: {
    id: string;
    kind: string;
    methodologyVersion: string;
    status: DeterminationStatus;
    createdAt: string | null;
  };
  policy: {
    policyNumber: string | null;
    organizationName: string | null;
    coverageType: string | null;
    sumInsured: string | null;
    currency: string | null;
    durationDays: number | null;
  } | null;
  provenance: unknown;
  canonical: {
    schemaVersion: string | null;
    body: unknown;
    hash: string | null;
    signer: string | null;
    signature: string | null;
  } | null;
  notary: unknown;
  verification: {
    available?: boolean;
    reason?: string;
    method?: string;
    reproducer?: string;
    [key: string]: unknown;
  };
}

/** Request body for POST /determinations/:determinationId/settlement-report. */
export interface SettlementReportInput {
  partnerReference: string;
  outcome: PartnerSettlementOutcome;
  method: PartnerSettlementMethod;
  /** Minor units of `settlementCurrency`, canonical decimal STRING. Never a number. */
  settledAmountMinor: string;
  settlementCurrency: string;
  settledAt: string;
  attestingOfficerName: string;
  attestingOfficerTitle: string;
  attestingOfficerEmail?: string;
  shortfallReason?: string;
  declineReason?: string;
  evidenceRef?: string;
  evidenceHash?: string;
  notes?: string;
  supersedesReportId?: string;
}

/** 201 on a first recording; 200 with `replayed: true` on a replay of the same key. */
export interface SettlementReportResult {
  replayed: boolean;
  determinationId: string;
  policyId: string | null;
  settlementMode: ServiceTier | null;
  settledByMicrocrop: false;
  verifiedByMicrocrop: false;
  partnerSettlementStatus: string;
  report: PartnerSettlementReport;
  note: string;
}

/** GET /determinations/:determinationId/settlement-report — the whole correction chain. */
export interface SettlementReportsResponse {
  determinationId: string;
  policyId: string | null;
  settlementMode: ServiceTier | null;
  partnerSettlementStatus: string | null;
  dueAt: string | null;
  verifiedByMicrocrop: false;
  current: PartnerSettlementReport | null;
  reports: PartnerSettlementReport[];
  note: string;
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

// ============================================
// PERMISSIONS (GET /api/staff/me/permissions)
// ============================================
export interface MyPermissions {
  role: UserRole;
  label: string;
  permissions: string[];
  can: {
    manageStaff: boolean;
    exportData: boolean;
    retryPayouts: boolean;
    writePolicies: boolean;
    editFarmers: boolean;
    bulkImport: boolean;
    decideKyc: boolean;
  };
}

// ============================================
// FARMER CONSENT (Kenya Data Protection Act 2019)
//
// Mirrors microcrop-backend src/config/consent.js + src/services/consent.service.js.
//
// NOTE FOR ANYONE EDITING THE UI THAT RENDERS THESE: `body` is the ONLY source of
// consent wording. It is null for every document in the registry today and the
// dashboard must never substitute prose of its own — see FarmerConsentPanel.
// ============================================

/** Mirrors the Prisma `ConsentMethod` enum / CONSENT_METHODS in the backend registry. */
export type ConsentMethod =
  | 'IN_PERSON_VERBAL_ATTESTED'
  | 'IN_PERSON_SIGNATURE'
  | 'SMS_REPLY'
  | 'USSD'
  | 'WEB_FORM'
  | 'PAPER_RECORD_IMPORT';

/**
 * Derived consent state for one document.
 *
 * NOT_GIVEN ("never asked") and REVOKED ("agreed, then withdrew") are different facts
 * and the UI must never collapse them. SUPERSEDED means consent exists but against an
 * older version of the document.
 */
export type ConsentStatus = 'NOT_GIVEN' | 'GRANTED' | 'REVOKED' | 'SUPERSEDED';

/** One entry of GET /farmers/consent/documents. */
export interface ConsentDocument {
  documentId: string;
  version: string;
  approved: boolean;
  required: boolean;
  purpose: string;
  /** The exact wording shown to the farmer. Null while the document is a placeholder. */
  body: string | null;
  bodySha256: string | null;
  /** Present only while `approved` is false. Render it verbatim; never paraphrase. */
  warning?: string;
  /** Present only while `approved` is false. What a human still has to do. */
  todo?: string;
}

export interface ConsentDocumentsResponse {
  documents: ConsentDocument[];
  approvedCopyAvailable: boolean;
  warning?: string;
}

/** A stored FarmerConsent row as the API returns it. */
export interface FarmerConsentRecord {
  id: string;
  documentVersion: string;
  documentHash: string | null;
  method: ConsentMethod;
  evidenceRef: string | null;
  locale: string | null;
  capturedByUserId: string | null;
  grantedAt: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokedReason: string | null;
  capturedAgainstPlaceholder?: boolean;
}

/** Per-document status inside GET /farmers/:farmerId/consent. */
export interface FarmerConsentDocumentStatus {
  documentId: string;
  requiredVersion: string;
  required: boolean;
  documentApproved: boolean;
  purpose: string;
  status: ConsentStatus;
  consent: FarmerConsentRecord | null;
  warning?: string;
  todo?: string;
}

export interface FarmerConsentMissingEntry {
  documentId: string;
  status: ConsentStatus;
  /** Set when consent exists but was captured against unapproved placeholder wording. */
  unusable?: string;
}

/** GET /farmers/:farmerId/consent. */
export interface FarmerConsentStatus {
  farmerId: string;
  documents: FarmerConsentDocumentStatus[];
  hasValidConsent: boolean;
  missing: FarmerConsentMissingEntry[];
  /**
   * The backend reports whether consent actually gates policy purchase. It is `false`
   * today and the UI must say so rather than implying anything is being enforced.
   */
  enforcedOnPurchase: boolean;
  warning?: string;
}

/** POST /farmers/:farmerId/consent — 201 on a new row, 200 on a replay. */
export interface RecordConsentResponse {
  consent: FarmerConsentRecord;
  replayed: boolean;
  status: ConsentStatus;
  documentApproved: boolean;
  warning?: string;
}

/** POST /farmers/:farmerId/consent/withdraw. */
export interface WithdrawConsentResponse {
  consent: FarmerConsentRecord;
  alreadyRevoked: boolean;
  status: ConsentStatus;
}
