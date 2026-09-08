/**
 * SIMULATED (sandbox / UAT) RECORD DETECTION.
 *
 * The backend can run premium collection, policy activation and payout settlement in a
 * sandbox mode (`SIMULATE_PAYMENTS=true` outside production, see
 * microcrop-backend/src/services/simulated-payment.service.js). In that mode NO M-Pesa
 * prompt is sent, NO money moves and NO policy is written to a chain — but the rows land
 * in the SAME tables the real path writes, with the same statuses. A simulated policy
 * reaches ACTIVE; a simulated payout reaches COMPLETED.
 *
 * Until this module existed the dashboard rendered those rows identically to real ones, so
 * in a UAT an operator could not tell a policy that was really sold and paid for from one
 * a test activated with no money involved — which is how someone ends up believing a
 * farmer is covered, or reporting test payouts as real disbursements.
 *
 * WHICH SIGNAL, AND WHY
 * ---------------------
 * The backend marks each entity in several independent places. We deliberately use only
 * signals that the API actually returns to this client:
 *
 *   POLICY   `GET /policies` and `GET /policies/:id` return the raw Prisma Policy row
 *            (policy.service.js `list`/`getById` use `include`, never `select`), so all
 *            three activation markers reach us:
 *              onChainPolicyId  "SIMULATED-NO-CHAIN-POLICY-…"  real: a decimal uint256
 *              txHash           "SIMULATED-NO-CHAIN-TX-…"      real: 0x + 64 hex
 *              blockNumber      -1                             real: a positive height
 *            Any ONE is decisive, so a partially-written row is still recognised. Note
 *            `blockNumber` is a Prisma BigInt and arrives as the STRING "-1" (app.js
 *            installs `BigInt.prototype.toJSON`), hence the numeric coercion below.
 *
 *   PAYOUT   `GET /payouts` and `GET /payouts/:id` return the raw Prisma Payout row, so
 *            `mpesaRef` ("SIMULATED-NO-REAL-MONEY-…") reaches us. That is the settlement
 *            receipt and is only written once the payout COMPLETES, so it alone would
 *            leave a PENDING/PROCESSING sandbox payout unmarked. Both endpoints also
 *            include the parent policy (the list selects `policy.onChainPolicyId`
 *            explicitly), so we fall back to the policy markers — a payout against a
 *            simulated policy is itself test data from the moment it is created.
 *
 *   PAYMENT  Transaction rows are marked by `metadata.simulated` / `metadata.provider`,
 *            a "SIMULATED-" `reference` prefix and a "SIMULATED-NO-REAL-MONEY-"
 *            `externalRef`. `POST /payments/initiate` additionally returns an explicit
 *            `simulated: true` on the response body (see `PaymentInitiateResponse`).
 *
 * NOT EXPOSED: there is no transaction LIST endpoint on this client — transactions are
 * only reachable as a CSV export (`GET /export/transactions`) and as the
 * `/payments/initiate` response. So the only in-app payment surface that can be marked is
 * the onboarding payment step, which is marked from that response.
 *
 * These predicates are intentionally string-prefix based rather than trusting a single
 * boolean: the prefixes are the same greppable strings the backend, the database and
 * every export carry, and a real value can never collide with them.
 */

/** Prefix the backend puts on `Transaction.reference` for simulated payments. */
export const SIMULATED_REFERENCE_PREFIX = 'SIMULATED-';

/** Prefix on every on-chain artifact written by a simulated policy activation. */
export const SIMULATED_ONCHAIN_PREFIX = 'SIMULATED-NO-CHAIN-';

/** Prefix on the pseudo M-Pesa receipt of a simulated payout / settled simulated payment. */
export const SIMULATED_MPESA_PREFIX = 'SIMULATED-NO-REAL-MONEY-';

/**
 * The one sentence shown to a user next to any simulated record. Deliberately free of
 * internal vocabulary (no "SIMULATE_PAYMENTS", no "sandbox flag"): a partner being
 * demoed to has to understand it without knowing how the service is configured.
 */
export const SIMULATED_EXPLANATION =
  'Test data — no real money. This record was created by a test: no payment was taken, ' +
  'nothing was sent to the farmer, and it is not recorded on the blockchain.';

/** Short label. Uppercase and status-free so it cannot read as a workflow state. */
export const SIMULATED_LABEL = 'TEST DATA — NO REAL MONEY';

function hasPrefix(value: unknown, prefix: string): boolean {
  return typeof value === 'string' && value.startsWith(prefix);
}

/**
 * A negative block height is impossible on any chain, so `blockNumber < 0` means "this was
 * never on a chain". Accepts the string form because Prisma BigInt is JSON-serialised as a
 * string; ignores null/undefined/empty and anything non-numeric.
 */
function isNegativeBlockNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n < 0;
}

/** The subset of a Policy that carries the simulation markers. */
export interface SimulatedPolicyMarkers {
  onChainPolicyId?: string | null;
  txHash?: string | null;
  blockNumber?: string | number | null;
}

/** The subset of a Payout that carries the simulation markers. */
export interface SimulatedPayoutMarkers {
  mpesaRef?: string | null;
  policy?: SimulatedPolicyMarkers | null;
}

/** The subset of a Transaction that carries the simulation markers. */
export interface SimulatedTransactionMarkers {
  reference?: string | null;
  externalRef?: string | null;
  metadata?: Record<string, unknown> | null;
  simulated?: boolean;
}

/** True when this policy was activated by a sandbox test rather than a real premium. */
export function isSimulatedPolicy(policy: SimulatedPolicyMarkers | null | undefined): boolean {
  if (!policy) return false;
  return (
    hasPrefix(policy.onChainPolicyId, SIMULATED_ONCHAIN_PREFIX) ||
    hasPrefix(policy.txHash, SIMULATED_ONCHAIN_PREFIX) ||
    isNegativeBlockNumber(policy.blockNumber)
  );
}

/** True when this payout is test data — no disbursement was made to anybody. */
export function isSimulatedPayout(payout: SimulatedPayoutMarkers | null | undefined): boolean {
  if (!payout) return false;
  return hasPrefix(payout.mpesaRef, SIMULATED_MPESA_PREFIX) || isSimulatedPolicy(payout.policy);
}

/** True when this payment/transaction moved no money. */
export function isSimulatedTransaction(
  transaction: SimulatedTransactionMarkers | null | undefined,
): boolean {
  if (!transaction) return false;
  const metadata = transaction.metadata ?? undefined;
  return (
    transaction.simulated === true ||
    metadata?.simulated === true ||
    metadata?.provider === 'simulated' ||
    hasPrefix(transaction.reference, SIMULATED_REFERENCE_PREFIX) ||
    hasPrefix(transaction.externalRef, SIMULATED_MPESA_PREFIX)
  );
}
