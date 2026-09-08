/**
 * CROSS-REPO SHAPE GUARD for sandbox ("test data") detection.
 *
 * Every literal in this file is a real marker written by
 * microcrop-backend/src/services/simulated-payment.service.js and
 * src/workers/payout.worker.js. If the backend ever changes a prefix, these tests are what
 * should fail — the alternative is a UAT in which test policies and test payouts render as
 * real ones and nobody notices.
 */
import {
  SIMULATED_MPESA_PREFIX,
  SIMULATED_ONCHAIN_PREFIX,
  SIMULATED_REFERENCE_PREFIX,
  isSimulatedPayout,
  isSimulatedPolicy,
  isSimulatedTransaction,
} from '../simulated';

describe('simulated markers', () => {
  it('matches the prefixes the backend writes', () => {
    expect(SIMULATED_REFERENCE_PREFIX).toBe('SIMULATED-');
    expect(SIMULATED_ONCHAIN_PREFIX).toBe('SIMULATED-NO-CHAIN-');
    expect(SIMULATED_MPESA_PREFIX).toBe('SIMULATED-NO-REAL-MONEY-');
  });
});

describe('isSimulatedPolicy', () => {
  // A policy activated in sandbox mode. All three markers, exactly as
  // simulateOnChainActivation() writes them (blockNumber arrives as a string because
  // Prisma BigInt is JSON-serialised via BigInt.prototype.toJSON).
  const simulated = {
    onChainPolicyId: 'SIMULATED-NO-CHAIN-POLICY-A1B2C3D4E5F6',
    txHash: 'SIMULATED-NO-CHAIN-TX-A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4',
    blockNumber: '-1',
  };

  // A real, settled policy: a decimal uint256 id, a 0x hash, a positive height.
  const real = {
    onChainPolicyId: '4213',
    txHash: '0x' + 'a'.repeat(64),
    blockNumber: '18450231',
  };

  it('flags a policy carrying all three simulated markers', () => {
    expect(isSimulatedPolicy(simulated)).toBe(true);
  });

  it.each([
    ['onChainPolicyId alone', { ...real, onChainPolicyId: simulated.onChainPolicyId }],
    ['txHash alone', { ...real, txHash: simulated.txHash }],
    ['a negative blockNumber alone', { ...real, blockNumber: '-1' }],
    ['a negative numeric blockNumber', { ...real, blockNumber: -1 }],
  ])('flags a partially-written row on %s', (_label, policy) => {
    expect(isSimulatedPolicy(policy)).toBe(true);
  });

  it('does not flag a real settled policy', () => {
    expect(isSimulatedPolicy(real)).toBe(false);
  });

  it('does not flag a PENDING policy that has no on-chain state yet', () => {
    // The dangerous false positive: "not on chain yet" is not "test data".
    expect(
      isSimulatedPolicy({ onChainPolicyId: null, txHash: null, blockNumber: null }),
    ).toBe(false);
    expect(isSimulatedPolicy({})).toBe(false);
    expect(isSimulatedPolicy(undefined)).toBe(false);
  });

  it('does not treat block 0 as simulated', () => {
    // 0 is genesis, which is why the backend chose -1 as the sentinel.
    expect(isSimulatedPolicy({ ...real, blockNumber: 0 })).toBe(false);
    expect(isSimulatedPolicy({ ...real, blockNumber: '' })).toBe(false);
  });
});

describe('isSimulatedPayout', () => {
  it('flags a settled sandbox payout by its pseudo M-Pesa receipt', () => {
    expect(isSimulatedPayout({ mpesaRef: 'SIMULATED-NO-REAL-MONEY-0A1B2C3D4E5F' })).toBe(true);
  });

  it('flags an unsettled sandbox payout via its parent policy', () => {
    // mpesaRef is only written on completion, so a PENDING/PROCESSING sandbox payout
    // would otherwise render as real for the whole time it is in flight.
    expect(
      isSimulatedPayout({
        mpesaRef: null,
        policy: { onChainPolicyId: 'SIMULATED-NO-CHAIN-POLICY-A1B2C3D4E5F6' },
      }),
    ).toBe(true);
  });

  it('does not flag a real payout', () => {
    expect(
      isSimulatedPayout({
        mpesaRef: 'QK12AB34CD',
        policy: { onChainPolicyId: '4213', txHash: '0x' + 'b'.repeat(64), blockNumber: '18450231' },
      }),
    ).toBe(false);
  });

  it('does not flag a real payout that has not settled yet', () => {
    expect(isSimulatedPayout({ mpesaRef: null, policy: { onChainPolicyId: '4213' } })).toBe(false);
    expect(isSimulatedPayout({})).toBe(false);
    expect(isSimulatedPayout(null)).toBe(false);
  });
});

describe('isSimulatedTransaction', () => {
  it.each([
    ['metadata.simulated', { metadata: { simulated: true } }],
    ['metadata.provider', { metadata: { provider: 'simulated' } }],
    ['a SIMULATED- reference', { reference: 'SIMULATED-payout-abc-123' }],
    ['a pseudo M-Pesa externalRef', { externalRef: 'SIMULATED-NO-REAL-MONEY-0A1B2C3D4E5F' }],
    ['the initiate response flag', { simulated: true }],
  ])('flags a sandbox payment by %s', (_label, transaction) => {
    expect(isSimulatedTransaction(transaction)).toBe(true);
  });

  it('does not flag a real payment', () => {
    expect(
      isSimulatedTransaction({
        reference: '8f2a1c04-1e2b-4d3c-9a77-0c1d2e3f4a5b',
        externalRef: 'QK12AB34CD',
        metadata: { provider: 'PRETIUM' },
      }),
    ).toBe(false);
    expect(isSimulatedTransaction({ metadata: null })).toBe(false);
    expect(isSimulatedTransaction(undefined)).toBe(false);
  });
});
