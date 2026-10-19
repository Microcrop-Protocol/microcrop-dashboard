/**
 * Base is retired: a legacy Base settlement stays readable but is never a BaseScan link (unless
 * the Base switch is on), and a Stellar notary anchor links to stellar.expert on its own network.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettlementFactCard } from '../SettlementFactCard';
import { DeterminedFactCard } from '../DeterminedFactCard';
import type { DeterminedFact, SettlementFact } from '@/types';

vi.mock('@/lib/api', () => ({ api: { getDeterminationEvidence: vi.fn() } }));

const BASE_TX = `0x${'b'.repeat(64)}`;
const STELLAR_TX = 'c'.repeat(64);

const tier2: SettlementFact = {
  mode: 'DETERMINATION_AND_SETTLEMENT',
  settledByMicrocrop: true,
  status: 'SETTLEMENT_SUBMITTED_ON_CHAIN',
  reason: null,
  amountOwed: null,
  failureReason: null,
  onChain: {
    chainId: 84532,
    verifyingContract: `0x${'1'.repeat(40)}`,
    submittedTxHash: BASE_TX,
    blockNumber: '123',
    payoutAmountUsdc: '1000000',
  },
};

const determined = (notary: DeterminedFact['notary']): DeterminedFact => ({
  kind: 'CROP_DAMAGE',
  schemaVersion: '1',
  methodologyVersion: 'm1',
  unitCode: null,
  triggered: true,
  thresholdBp: 3000,
  damagePercentBp: 4000,
  assessedAt: null,
  determinedAt: null,
  canonicalHash: '0xhash',
  signerAddress: '0xsigner',
  notary,
  evidence: { available: false, href: '/x', verifiable: true },
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('legacy Base settlement', () => {
  it('is readable, labelled retired, and not a link while Base is off', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', '');
    render(<SettlementFactCard settlement={tier2} />);
    expect(screen.getByText(/Base \(retired\)/)).toBeInTheDocument();
    expect(screen.getByText(BASE_TX)).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('basescan');
  });

  it('links to BaseScan again with the Base switch on', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', 'true');
    render(<SettlementFactCard settlement={tier2} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', `https://basescan.org/tx/${BASE_TX}`);
  });
});

describe('notary anchor', () => {
  it('links a Stellar anchor to stellar.expert on the receipt network', () => {
    vi.stubEnv('VITE_STELLAR_NETWORK', 'public');
    render(
      <DeterminedFactCard
        determinationId="d1"
        determined={determined({ provider: 'stellar', network: 'testnet', reference: '0xref', txHash: STELLAR_TX })}
      />,
    );
    expect(screen.getByText('Notary (Stellar testnet)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /0xref/ })).toHaveAttribute(
      'href',
      `https://stellar.expert/explorer/testnet/tx/${STELLAR_TX}`,
    );
  });

  it('keeps a non-Stellar anchor as text', () => {
    render(
      <DeterminedFactCard
        determinationId="d1"
        determined={determined({ provider: 'private-log', reference: '0xref' })}
      />,
    );
    expect(screen.getByText('Notary (private-log)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /0xref/ })).not.toBeInTheDocument();
  });
});
