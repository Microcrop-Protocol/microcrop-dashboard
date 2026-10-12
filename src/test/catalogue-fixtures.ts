/**
 * `GET /api/catalogue` response fixtures for tests, shaped as the contract specifies. The codes,
 * statuses and TLU factors are the product decisions the backend catalogue encodes; the prose
 * fields are representative only — no test asserts on their wording.
 */
import type { CatalogueItem, CatalogueMarket, CatalogueStatus } from '@/types/catalogue';

function crop(code: string, label: string, status: CatalogueStatus, precedent: string): CatalogueItem {
  return {
    code,
    label,
    status,
    sellable: status !== 'COMING_SOON',
    peril: 'Drought',
    index: 'Rainfall deficit (CHIRPS)',
    coverPeriod: 'Growing season',
    insurableUnit: 'Plot',
    precedent,
  };
}

function livestock(code: string, label: string, tluFactor: number): CatalogueItem {
  return {
    code,
    label,
    status: 'AVAILABLE',
    sellable: true,
    peril: 'Forage drought',
    index: 'Cumulative standardised NDVI per insurance unit',
    coverPeriod: 'LRLD (Mar–Sep) / SRSD (Oct–Feb)',
    insurableUnit: 'TLU',
    precedent: 'KLIP / DRIVE',
    tluFactor,
  };
}

export const KE_CATALOGUE: CatalogueMarket = {
  countryCode: 'KE',
  countryName: 'Kenya',
  currency: 'KES',
  lines: {
    CROP: [
      crop('MAIZE', 'Maize', 'AVAILABLE', 'KAIP / ACRE'),
      crop('SORGHUM', 'Sorghum', 'PILOT', 'KAIP / ACRE'),
      crop('GREEN_GRAMS', 'Green grams', 'PILOT', 'KAIP / ACRE'),
      crop('BEANS', 'Beans', 'PILOT', 'KAIP / ACRE'),
      crop('MILLET', 'Millet', 'PILOT', 'KAIP / ACRE'),
      crop('POTATOES', 'Potatoes', 'COMING_SOON', 'KAIP / ACRE'),
      crop('WHEAT', 'Wheat', 'COMING_SOON', 'KAIP / ACRE'),
      crop('COFFEE', 'Coffee', 'COMING_SOON', 'KAIP / ACRE'),
      crop('RICE', 'Rice', 'COMING_SOON', 'KAIP / ACRE'),
      crop('BARLEY', 'Barley', 'COMING_SOON', 'KAIP / ACRE'),
    ],
    LIVESTOCK: [
      livestock('CATTLE', 'Cattle', 1.0),
      livestock('CAMEL', 'Camel', 1.4),
      livestock('GOAT', 'Goat', 0.1),
      livestock('SHEEP', 'Sheep', 0.1),
    ],
  },
};

export const GH_CATALOGUE: CatalogueMarket = {
  countryCode: 'GH',
  countryName: 'Ghana',
  currency: 'GHS',
  lines: {
    CROP: [
      crop('MAIZE', 'Maize', 'PILOT', 'GAIP'),
      crop('SOYBEAN', 'Soybean', 'PILOT', 'GAIP'),
      crop('SORGHUM', 'Sorghum', 'PILOT', 'GAIP'),
      crop('GROUNDNUT', 'Groundnut', 'PILOT', 'GAIP'),
      crop('MILLET', 'Millet', 'COMING_SOON', 'GAIP'),
      crop('COWPEA', 'Cowpea', 'COMING_SOON', 'GAIP'),
      crop('RICE', 'Rice', 'COMING_SOON', 'GAIP'),
    ],
    LIVESTOCK: [],
  },
};
