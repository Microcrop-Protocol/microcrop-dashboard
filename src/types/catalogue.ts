/**
 * PRODUCT CATALOGUE — `GET /api/catalogue`, served from microcrop-backend/src/config/catalogue.js.
 *
 * Every market has a catalogue of crop and livestock products. AVAILABLE and PILOT items are
 * SELLABLE (quote + purchase); COMING_SOON items are listed but refused at quote/purchase with
 * 409 PRODUCT_NOT_OFFERED. An item that is not listed at all cannot be used for a new plot, herd
 * or policy in that market (400 PRODUCT_NOT_IN_MARKET).
 *
 * The server derives `sellable` from `status`. The dashboard reads `sellable` rather than
 * re-deriving it, so the two can never disagree about what may be sold.
 *
 * Org users receive only their own market; a PLATFORM_ADMIN receives every market.
 */

export type CatalogueStatus = 'AVAILABLE' | 'PILOT' | 'COMING_SOON';

export type CatalogueLine = 'CROP' | 'LIVESTOCK';

export interface CatalogueItem {
  /** CropType / LivestockType enum value, e.g. MAIZE, GREEN_GRAMS, CATTLE. */
  code: string;
  label: string;
  status: CatalogueStatus;
  /** Derived server-side: true for AVAILABLE and PILOT. */
  sellable: boolean;
  peril: string;
  index: string;
  coverPeriod: string;
  insurableUnit: string;
  precedent: string;
  /** Tropical Livestock Unit conversion factor. Livestock items only. */
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
