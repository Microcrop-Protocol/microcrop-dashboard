/**
 * Settlement chain + block-explorer links.
 *
 * BASE IS RETIRED (2026-10-19). Stellar (Soroban) is the only chain MicroCrop writes to, and on
 * Stellar MicroCrop never handles funds: the insurer settles, MicroCrop verifies and records.
 * Phase 1 switches Base off REVERSIBLY: nothing EVM is deleted, existing Base rows stay
 * readable, and every Base-only surface (org wallet provisioning, on-chain reserve ratio, the
 * PlatformTreasury page, BaseScan links) sits behind ONE build-time switch that mirrors the
 * backend's BASE_SETTLEMENT_ENABLED:
 *
 *   VITE_BASE_SETTLEMENT_ENABLED=true   restore the Base surfaces (only with the backend's own
 *                                       switch on — otherwise every action is a 409 BASE_RETIRED)
 *   anything else / unset (default)     Base surfaces hidden; legacy Base hashes render as text
 *
 * Stellar links go to stellar.expert. The network comes from the record itself when it says
 * (a notary receipt carries `network`), else VITE_STELLAR_NETWORK, else `testnet` — the only
 * network MicroCrop's Stellar path runs on today. A link to the wrong network is a 404 that
 * reads as "the anchor does not exist", so a record's own network always wins.
 */

/** Read at call time so a test can flip it with vi.stubEnv. */
export function isBaseSettlementEnabled(): boolean {
  return import.meta.env.VITE_BASE_SETTLEMENT_ENABLED === 'true';
}

export type StellarNetwork = 'testnet' | 'public';

/** Base mainnet / Base Sepolia. Used only to label legacy rows; never to route anything. */
export const BASE_CHAIN_IDS: ReadonlySet<number> = new Set([8453, 84532]);

export function isBaseChainId(chainId: number | null | undefined): boolean {
  return chainId != null && BASE_CHAIN_IDS.has(chainId);
}

function normaliseStellarNetwork(raw: unknown): StellarNetwork | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'public' || v === 'mainnet' || v === 'pubnet') return 'public';
  if (v === 'testnet') return 'testnet';
  return null;
}

/** The record's own network when it names one, else the build default, else testnet. */
export function stellarNetwork(fromRecord?: string | null): StellarNetwork {
  return (
    normaliseStellarNetwork(fromRecord) ??
    normaliseStellarNetwork(import.meta.env.VITE_STELLAR_NETWORK) ??
    'testnet'
  );
}

/** Human label for a Stellar network, e.g. "Stellar testnet" / "Stellar mainnet". */
export function stellarNetworkLabel(fromRecord?: string | null): string {
  return stellarNetwork(fromRecord) === 'public' ? 'Stellar mainnet' : 'Stellar testnet';
}

const STELLAR_EXPERT = 'https://stellar.expert/explorer';

/** A Stellar transaction hash is 64 hex chars, no 0x prefix. Anything else gets no link. */
const STELLAR_TX_HASH = /^[0-9a-f]{64}$/i;

export function stellarTxUrl(
  txHash: string | null | undefined,
  network?: string | null,
): string | null {
  if (!txHash || !STELLAR_TX_HASH.test(txHash)) return null;
  return `${STELLAR_EXPERT}/${stellarNetwork(network)}/tx/${txHash.toLowerCase()}`;
}

export function stellarAccountUrl(
  address: string | null | undefined,
  network?: string | null,
): string | null {
  if (!address || !/^[GC][A-Z2-7]{55}$/.test(address)) return null;
  return `${STELLAR_EXPERT}/${stellarNetwork(network)}/${address.startsWith('C') ? 'contract' : 'account'}/${address}`;
}

// --- Legacy Base (EVM) links ---------------------------------------------------------------
// Returned ONLY while the Base switch is on. With Base retired a BaseScan link is a dead action
// on a chain MicroCrop no longer operates, so callers get null and render the hash as text.

function baseExplorerRoot(): string {
  return (import.meta.env.VITE_EXPLORER_BASE_URL || 'https://basescan.org').replace(/\/$/, '');
}

export function baseExplorerAddressUrl(address: string | null | undefined): string | null {
  if (!isBaseSettlementEnabled() || !address) return null;
  return `${baseExplorerRoot()}/address/${address}`;
}

export function baseExplorerTxUrl(txHash: string | null | undefined): string | null {
  if (!isBaseSettlementEnabled() || !txHash) return null;
  return `${baseExplorerRoot()}/tx/${txHash}`;
}
