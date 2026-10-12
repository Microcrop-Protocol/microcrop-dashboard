/**
 * CATALOGUE PRESENTATION.
 *
 *   1. `sellable` IS THE SERVER'S. A summary counts the server's flag, not a status the
 *      dashboard re-derives — so the page cannot call an item sellable that the quote endpoint
 *      would refuse with PRODUCT_NOT_OFFERED.
 *   2. THREE STATUSES, THREE LOOKS, and an unknown status is shown as sent rather than hidden.
 */
import { describe, it, expect } from 'vitest';
import {
  catalogueStatusLabel,
  catalogueStatusVariant,
  sortCatalogueItems,
  summarizeCatalogueMarket,
} from '@/lib/platform-catalogue';
import type { CatalogueItem, CatalogueMarket } from '@/types/catalogue';

function item(overrides: Partial<CatalogueItem>): CatalogueItem {
  return {
    code: 'MAIZE',
    label: 'Maize',
    status: 'AVAILABLE',
    sellable: true,
    peril: 'Drought',
    index: 'Rainfall deficit (CHIRPS)',
    coverPeriod: 'Season',
    insurableUnit: 'Plot',
    precedent: 'KAIP',
    ...overrides,
  };
}

describe('status presentation', () => {
  it('labels and colours the three statuses', () => {
    expect(catalogueStatusLabel('AVAILABLE')).toBe('Available');
    expect(catalogueStatusLabel('PILOT')).toBe('Pilot');
    expect(catalogueStatusLabel('COMING_SOON')).toBe('Coming soon');
    expect(catalogueStatusVariant('AVAILABLE')).toBe('success');
    expect(catalogueStatusVariant('PILOT')).toBe('info');
    expect(catalogueStatusVariant('COMING_SOON')).toBe('default');
  });

  it('shows an unrecognised status as sent', () => {
    expect(catalogueStatusLabel('RETIRED')).toBe('RETIRED');
  });
});

describe('sortCatalogueItems', () => {
  it('puts sellable-today first, then by label, without mutating the response', () => {
    const items = [
      item({ code: 'WHEAT', label: 'Wheat', status: 'COMING_SOON', sellable: false }),
      item({ code: 'SORGHUM', label: 'Sorghum', status: 'PILOT' }),
      item({ code: 'BEANS', label: 'Beans', status: 'PILOT' }),
      item({ code: 'MAIZE', label: 'Maize', status: 'AVAILABLE' }),
    ];
    const before = items.map((i) => i.code);
    expect(sortCatalogueItems(items).map((i) => i.code)).toEqual(['MAIZE', 'BEANS', 'SORGHUM', 'WHEAT']);
    expect(items.map((i) => i.code)).toEqual(before);
  });
});

describe('summarizeCatalogueMarket', () => {
  it("counts the server's sellable flag, not the status", () => {
    const market: CatalogueMarket = {
      countryCode: 'GH',
      countryName: 'Ghana',
      currency: 'GHS',
      lines: {
        CROP: [
          item({ code: 'MAIZE', status: 'PILOT', sellable: true }),
          // A server that says PILOT-but-not-sellable is believed.
          item({ code: 'SOYBEAN', status: 'PILOT', sellable: false }),
          item({ code: 'RICE', status: 'COMING_SOON', sellable: false }),
        ],
        LIVESTOCK: [],
      },
    };
    expect(summarizeCatalogueMarket(market)).toEqual({ crop: 3, livestock: 0, sellable: 1, comingSoon: 1 });
  });
});
