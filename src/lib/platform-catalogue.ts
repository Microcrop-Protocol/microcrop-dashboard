/**
 * PRODUCT CATALOGUE — presentation helpers for the platform-admin catalogue page.
 *
 * The catalogue itself is served by `GET /api/catalogue` from the backend's config/catalogue.js
 * and is read-only here: what a market offers changes with a backend deploy, not from this
 * screen. Nothing in this file decides what may be sold. In particular `sellable` is read from
 * the server's item, never re-derived from `status`, so the page can never show an item as
 * sellable that the quote endpoint would refuse with PRODUCT_NOT_OFFERED.
 */
import type { CatalogueItem, CatalogueLine, CatalogueMarket, CatalogueStatus } from '@/types/catalogue';

/** Display order: the line partners onboard first, then the other. */
export const CATALOGUE_LINES: readonly CatalogueLine[] = ['CROP', 'LIVESTOCK'];

export const CATALOGUE_LINE_LABELS: Record<CatalogueLine, string> = {
  CROP: 'Crop',
  LIVESTOCK: 'Livestock',
};

const STATUS_LABELS: Record<CatalogueStatus, string> = {
  AVAILABLE: 'Available',
  PILOT: 'Pilot',
  COMING_SOON: 'Coming soon',
};

/** "Available", "Pilot", "Coming soon"; an unrecognised status is shown as sent, not hidden. */
export function catalogueStatusLabel(status: string): string {
  return STATUS_LABELS[status as CatalogueStatus] ?? status;
}

/**
 * StatusBadge variant. AVAILABLE reads as live, PILOT as live-but-limited, COMING_SOON as inert —
 * the same three meanings the quote endpoint enforces.
 */
export function catalogueStatusVariant(status: string): 'success' | 'info' | 'default' {
  if (status === 'AVAILABLE') return 'success';
  if (status === 'PILOT') return 'info';
  return 'default';
}

/** Status order within a line: what can be sold today first. */
const STATUS_ORDER: Record<string, number> = { AVAILABLE: 0, PILOT: 1, COMING_SOON: 2 };

/** Items of one line, sellable-first and then by label. Does not mutate the response. */
export function sortCatalogueItems(items: readonly CatalogueItem[]): CatalogueItem[] {
  return [...items].sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || a.label.localeCompare(b.label),
  );
}

export interface CatalogueMarketSummary {
  crop: number;
  livestock: number;
  sellable: number;
  comingSoon: number;
}

/** Counts for a market's header line. `sellable` counts the server's flag, not the status. */
export function summarizeCatalogueMarket(market: CatalogueMarket): CatalogueMarketSummary {
  const crop = market.lines?.CROP ?? [];
  const livestock = market.lines?.LIVESTOCK ?? [];
  const all = [...crop, ...livestock];
  return {
    crop: crop.length,
    livestock: livestock.length,
    sellable: all.filter((item) => item.sellable === true).length,
    comingSoon: all.filter((item) => item.status === 'COMING_SOON').length,
  };
}
