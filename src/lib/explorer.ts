// Block-explorer link helpers. Base mainnet by default; override with
// VITE_EXPLORER_BASE_URL (e.g. https://sepolia.basescan.org) for a testnet/demo
// build so on-chain links resolve on the right network.
const EXPLORER_BASE_URL = (
  import.meta.env.VITE_EXPLORER_BASE_URL || "https://basescan.org"
).replace(/\/$/, "");

export function explorerAddressUrl(address: string | null | undefined): string {
  return `${EXPLORER_BASE_URL}/address/${address ?? ""}`;
}

export function explorerTxUrl(txHash: string | null | undefined): string {
  return `${EXPLORER_BASE_URL}/tx/${txHash ?? ""}`;
}
