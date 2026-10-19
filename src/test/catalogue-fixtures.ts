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

/**
 * The hidden markets, as the backend catalogue lists them: every crop COMING_SOON (so nothing is
 * sellable) and no livestock line. Listed crops can still be registered on a plot.
 */
function hiddenMarket(
  countryCode: string,
  countryName: string,
  currency: string,
  crops: [string, string][],
): CatalogueMarket {
  return {
    countryCode,
    countryName,
    currency,
    lines: {
      CROP: crops.map(([code, label]) => crop(code, label, 'COMING_SOON', 'To be set')),
      LIVESTOCK: [],
    },
  };
}

export const UG_CATALOGUE = hiddenMarket('UG', 'Uganda', 'UGX', [
  ['MAIZE', 'Maize'], ['BEANS', 'Beans'], ['SORGHUM', 'Sorghum'], ['SOYBEAN', 'Soybean'],
  ['GROUNDNUT', 'Groundnut'], ['RICE', 'Rice'], ['COFFEE', 'Coffee'],
]);

export const TZ_CATALOGUE = hiddenMarket('TZ', 'Tanzania', 'TZS', [
  ['MAIZE', 'Maize'], ['BEANS', 'Beans'], ['SORGHUM', 'Sorghum'], ['WHEAT', 'Wheat'],
  ['COFFEE', 'Coffee'], ['POTATOES', 'Potatoes'], ['RICE', 'Rice'], ['MILLET', 'Millet'],
]);

export const ZM_CATALOGUE = hiddenMarket('ZM', 'Zambia', 'ZMW', [
  ['MAIZE', 'Maize'], ['SOYBEAN', 'Soybean'], ['GROUNDNUT', 'Groundnut'], ['SORGHUM', 'Sorghum'],
  ['MILLET', 'Millet'], ['BEANS', 'Beans'], ['WHEAT', 'Wheat'], ['RICE', 'Rice'],
]);

export const NG_CATALOGUE = hiddenMarket('NG', 'Nigeria', 'NGN', [
  ['MAIZE', 'Maize'], ['RICE', 'Rice'], ['SORGHUM', 'Sorghum'], ['MILLET', 'Millet'],
  ['SOYBEAN', 'Soybean'], ['GROUNDNUT', 'Groundnut'], ['COWPEA', 'Cowpea'],
]);

export const RW_CATALOGUE = hiddenMarket('RW', 'Rwanda', 'RWF', [
  ['MAIZE', 'Maize'], ['BEANS', 'Beans'], ['RICE', 'Rice'], ['POTATOES', 'Irish potato'],
  ['SOYBEAN', 'Soybean'], ['SORGHUM', 'Sorghum'],
]);
