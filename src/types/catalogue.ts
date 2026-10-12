/**
 * PRODUCT CATALOGUE — the wire shape of `GET /api/catalogue`.
 *
 * The backend's microcrop-backend/src/config/catalogue.js is the source of truth: which crops
 * and livestock each market lists, and with which status. This file only describes what the
 * endpoint returns. Nothing in the dashboard keeps a second copy of the lists.
 *
 * An organization user receives ONLY its own organization's market; a platform admin receives
 * every market.
 */

/**
 * AVAILABLE and PILOT are sellable (quote + purchase). COMING_SOON is listed so a partner can see
 * it, but cannot be quoted or sold.
 */
export type CatalogueStatus = 'AVAILABLE' | 'PILOT' | 'COMING_SOON';

export type CatalogueLine = 'CROP' | 'LIVESTOCK';

export interface CatalogueItem {
  /** The enum value the API takes: `cropType` for a plot, `livestockType` for a herd. */
  code: string;
  label: string;
  status: CatalogueStatus;
  /** Derived server-side from `status`. */
  sellable: boolean;
  peril: string;
  index: string;
  coverPeriod: string;
  insurableUnit: string;
  precedent: string;
  /** Tropical Livestock Units per head. Livestock items only. */
  tluFactor?: number;
}

export interface CatalogueMarket {
  countryCode: string;
  countryName: string;
  currency: string;
  lines: {
    CROP: CatalogueItem[];
    LIVESTOCK: CatalogueItem[];
  };
}

export interface CatalogueResponse {
  markets: CatalogueMarket[];
}
