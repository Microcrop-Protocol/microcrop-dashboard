/**
 * Base is retired (phase 1): Stellar links go to stellar.expert on the record's own network, and
 * a BaseScan link is produced only while VITE_BASE_SETTLEMENT_ENABLED is "true".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  baseExplorerAddressUrl,
  baseExplorerTxUrl,
  isBaseChainId,
  isBaseSettlementEnabled,
  stellarAccountUrl,
  stellarNetwork,
  stellarNetworkLabel,
  stellarTxUrl,
} from '@/lib/explorer';

const HASH = 'a'.repeat(64);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Base kill switch', () => {
  it('is off by default', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', '');
    expect(isBaseSettlementEnabled()).toBe(false);
    expect(baseExplorerTxUrl('0xabc')).toBeNull();
    expect(baseExplorerAddressUrl('0xabc')).toBeNull();
  });

  it.each(['1', 'TRUE', 'yes', 'false'])('stays off for %j', (value) => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', value);
    expect(isBaseSettlementEnabled()).toBe(false);
  });

  it('restores BaseScan links only when exactly "true"', () => {
    vi.stubEnv('VITE_BASE_SETTLEMENT_ENABLED', 'true');
    vi.stubEnv('VITE_EXPLORER_BASE_URL', 'https://sepolia.basescan.org/');
    expect(baseExplorerTxUrl('0xabc')).toBe('https://sepolia.basescan.org/tx/0xabc');
    expect(baseExplorerAddressUrl('0xdef')).toBe('https://sepolia.basescan.org/address/0xdef');
    expect(baseExplorerTxUrl(null)).toBeNull();
  });

  it('recognises Base chain ids only to label legacy rows', () => {
    expect(isBaseChainId(8453)).toBe(true);
    expect(isBaseChainId(84532)).toBe(true);
    expect(isBaseChainId(1)).toBe(false);
    expect(isBaseChainId(null)).toBe(false);
  });
});

describe('Stellar links', () => {
  it('defaults to testnet', () => {
    vi.stubEnv('VITE_STELLAR_NETWORK', '');
    expect(stellarNetwork()).toBe('testnet');
    expect(stellarTxUrl(HASH)).toBe(`https://stellar.expert/explorer/testnet/tx/${HASH}`);
    expect(stellarNetworkLabel()).toBe('Stellar testnet');
  });

  it('uses the build default when the record names no network', () => {
    vi.stubEnv('VITE_STELLAR_NETWORK', 'public');
    expect(stellarTxUrl(HASH)).toBe(`https://stellar.expert/explorer/public/tx/${HASH}`);
    expect(stellarNetworkLabel()).toBe('Stellar mainnet');
  });

  it("prefers the record's own network over the build default", () => {
    vi.stubEnv('VITE_STELLAR_NETWORK', 'public');
    expect(stellarTxUrl(HASH, 'testnet')).toBe(`https://stellar.expert/explorer/testnet/tx/${HASH}`);
    vi.stubEnv('VITE_STELLAR_NETWORK', 'testnet');
    expect(stellarTxUrl(HASH, 'mainnet')).toBe(`https://stellar.expert/explorer/public/tx/${HASH}`);
  });

  it('gives no link for something that is not a Stellar tx hash', () => {
    expect(stellarTxUrl(null)).toBeNull();
    expect(stellarTxUrl(`0x${'a'.repeat(64)}`)).toBeNull();
    expect(stellarTxUrl('abc')).toBeNull();
  });

  it('links accounts and contracts', () => {
    const account = `G${'A'.repeat(55)}`;
    const contract = `C${'A'.repeat(55)}`;
    expect(stellarAccountUrl(account, 'testnet')).toBe(
      `https://stellar.expert/explorer/testnet/account/${account}`,
    );
    expect(stellarAccountUrl(contract, 'public')).toBe(
      `https://stellar.expert/explorer/public/contract/${contract}`,
    );
    expect(stellarAccountUrl('0xabc')).toBeNull();
  });
});

describe('409 BASE_RETIRED', () => {
  it('reads as a retired feature, not a conflict', async () => {
    const { ApiError } = await import('@/lib/api/client');
    const { getErrorMessage } = await import('@/lib/error-messages');
    const msg = getErrorMessage(new ApiError('Base settlement is retired', 409, 'BASE_RETIRED'));
    expect(msg).toMatch(/Base settlement has been retired/);
    expect(msg).toMatch(/Stellar/);
  });
});
