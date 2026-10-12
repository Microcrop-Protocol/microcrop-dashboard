/**
 * lib/catalogue — reading the server's product catalogue without ever guessing it.
 *
 * The properties pinned here are the ones whose failure would put a refused choice in front of a
 * partner: the org's market is picked exactly (never defaulted to Kenya), sellability is a
 * positive test, a not-yet-loaded catalogue is never read as "not offered", and the catalogue
 * refusals are worded as product boundaries naming the crop and the country.
 */
import { describe, expect, it } from 'vitest';
import {
  catalogueItems,
  catalogueRefusalMessage,
  catalogueStatusLabel,
  exampleItem,
  findCatalogueItem,
  humanizeProductCode,
  isListed,
  isSellable,
  lineOffered,
  catalogueReasonLabel,
  matchCatalogueItem,
  notSellableNote,
  notSellableReason,
  productLabel,
  resolveCatalogueState,
  selectMarketCatalogue,
  soldUnderLabel,
  tluFor,
} from '@/lib/catalogue';
import { GH_CATALOGUE, KE_CATALOGUE } from '@/test/catalogue-fixtures';
import type { CatalogueItem } from '@/types/catalogue';

const BOTH = { markets: [KE_CATALOGUE, GH_CATALOGUE] };

describe('selectMarketCatalogue', () => {
  it("picks the organization's market by country code", () => {
    expect(selectMarketCatalogue(BOTH, 'GH')).toBe(GH_CATALOGUE);
    expect(selectMarketCatalogue(BOTH, ' ke ')).toBe(KE_CATALOGUE);
  });

  it('returns null on a country the response does not carry — no fallback to Kenya', () => {
    expect(selectMarketCatalogue({ markets: [KE_CATALOGUE] }, 'GH')).toBeNull();
  });

  it("uses a single-market response before the org's country is known (the server scoped it)", () => {
    expect(selectMarketCatalogue({ markets: [GH_CATALOGUE] }, null)).toBe(GH_CATALOGUE);
  });

  it('refuses to choose between several markets with no country in hand', () => {
    expect(selectMarketCatalogue(BOTH, null)).toBeNull();
  });

  it('tolerates an absent or malformed response', () => {
    expect(selectMarketCatalogue(undefined, 'KE')).toBeNull();
    expect(selectMarketCatalogue({ markets: null } as never, 'KE')).toBeNull();
  });
});

describe('resolveCatalogueState', () => {
  it('is loading only while there is no response and the request is in flight', () => {
    expect(resolveCatalogueState(null, false, true)).toBe('loading');
    expect(resolveCatalogueState(null, false, false)).toBe('unknown');
  });

  it("is unknown when the response carries no market for this organization", () => {
    expect(resolveCatalogueState(null, true, false)).toBe('unknown');
  });

  it('is known with a selected market, even during a background refetch', () => {
    expect(resolveCatalogueState(KE_CATALOGUE, true, true)).toBe('known');
  });
});

describe('isSellable', () => {
  it('sells AVAILABLE and PILOT, not COMING_SOON', () => {
    expect(isSellable(findCatalogueItem(KE_CATALOGUE, 'CROP', 'MAIZE'))).toBe(true);
    expect(isSellable(findCatalogueItem(KE_CATALOGUE, 'CROP', 'SORGHUM'))).toBe(true);
    expect(isSellable(findCatalogueItem(KE_CATALOGUE, 'CROP', 'WHEAT'))).toBe(false);
  });

  it('is written in the positive: a stringy or absent flag denies', () => {
    const maize = findCatalogueItem(KE_CATALOGUE, 'CROP', 'MAIZE') as CatalogueItem;
    expect(isSellable({ ...maize, sellable: 'true' as unknown as boolean })).toBe(false);
    expect(isSellable({ ...maize, sellable: undefined as unknown as boolean })).toBe(false);
    expect(isSellable(null)).toBe(false);
  });

  it('denies a sellable flag paired with a status that is not sold', () => {
    const wheat = findCatalogueItem(KE_CATALOGUE, 'CROP', 'WHEAT') as CatalogueItem;
    expect(isSellable({ ...wheat, sellable: true })).toBe(false);
  });

  it("honours the SERVER's sellable: false on a PILOT or AVAILABLE item it has not priced", () => {
    const maize = findCatalogueItem(KE_CATALOGUE, 'CROP', 'MAIZE') as CatalogueItem;
    expect(isSellable({ ...maize, sellable: false, reason: 'PRICING_NOT_CONFIGURED' })).toBe(false);
    const sorghum = findCatalogueItem(KE_CATALOGUE, 'CROP', 'SORGHUM') as CatalogueItem;
    expect(isSellable({ ...sorghum, sellable: false })).toBe(false);
  });
});

describe('the server\'s reason for a not-sellable item', () => {
  const maize = findCatalogueItem(KE_CATALOGUE, 'CROP', 'MAIZE') as CatalogueItem;
  const unpriced: CatalogueItem = { ...maize, sellable: false, reason: 'PRICING_NOT_CONFIGURED' };
  const wheat = findCatalogueItem(KE_CATALOGUE, 'CROP', 'WHEAT') as CatalogueItem;

  it('words PRICING_NOT_CONFIGURED, and a code it does not know generically', () => {
    expect(catalogueReasonLabel('PRICING_NOT_CONFIGURED')).toBe('Pricing not configured yet');
    expect(catalogueReasonLabel('SOMETHING_NEW')).toBe('Not available to sell yet');
    expect(catalogueReasonLabel(null)).toBeNull();
    expect(catalogueReasonLabel('')).toBeNull();
  });

  it('notes a not-sellable item by purpose — and nothing for a sellable one', () => {
    expect(notSellableNote(maize, 'Kenya', 'sell')).toBeNull();
    expect(notSellableNote(unpriced, 'Kenya', 'sell')).toBe('Pricing not configured yet');
    expect(notSellableNote(unpriced, 'Kenya', 'register')).toBe('Pricing not configured yet — cannot be insured yet');
    expect(notSellableNote(wheat, 'Kenya', 'sell')).toMatch(/Wheat cover is coming soon in Kenya/);
    expect(notSellableNote(wheat, 'Kenya', 'register')).toBe('Coming soon — cannot be insured yet');
  });

  it("explains an existing plot's unpriced crop with the server's reason, not as unlisted", () => {
    const market = { ...KE_CATALOGUE, lines: { ...KE_CATALOGUE.lines, CROP: [unpriced] } };
    const reason = notSellableReason(market, 'CROP', 'MAIZE');
    expect(reason).toBe('Maize cannot be quoted or sold in Kenya yet — pricing not configured yet.');
    expect(reason).not.toMatch(/not in the Kenya product catalogue/);
  });

  it('says a listed, unsellable item without a reason is listed — not missing', () => {
    const market = { ...KE_CATALOGUE, lines: { ...KE_CATALOGUE.lines, CROP: [{ ...maize, sellable: false }] } };
    expect(notSellableReason(market, 'CROP', 'MAIZE')).toBe(
      'Maize is listed in Kenya but cannot be quoted or sold yet.',
    );
  });
});

describe('listing and lines', () => {
  it('lists only what the market catalogue carries', () => {
    expect(isListed(KE_CATALOGUE, 'CROP', 'WHEAT')).toBe(true);
    expect(isListed(KE_CATALOGUE, 'CROP', 'TEA')).toBe(false);
    expect(isListed(GH_CATALOGUE, 'CROP', 'GREEN_GRAMS')).toBe(false);
    expect(isListed(KE_CATALOGUE, 'LIVESTOCK', 'POULTRY')).toBe(false);
  });

  it('reports Ghana livestock as not offered, and an unknown catalogue as null', () => {
    expect(lineOffered(GH_CATALOGUE, 'LIVESTOCK')).toBe(false);
    expect(lineOffered(KE_CATALOGUE, 'LIVESTOCK')).toBe(true);
    expect(lineOffered(null, 'LIVESTOCK')).toBeNull();
  });

  it('returns an empty line for a null market', () => {
    expect(catalogueItems(null, 'CROP')).toEqual([]);
  });
});

describe('labels', () => {
  it('humanizes a stored code the catalogue does not list', () => {
    expect(humanizeProductCode('SWEET_POTATO')).toBe('Sweet potato');
    expect(humanizeProductCode('')).toBe('');
    expect(productLabel(KE_CATALOGUE, 'CROP', 'TEA')).toBe('Tea');
  });

  it("prefers the catalogue's label for a listed code", () => {
    expect(productLabel(KE_CATALOGUE, 'CROP', 'GREEN_GRAMS')).toBe('Green grams');
  });

  it('badges PILOT and COMING_SOON, and not AVAILABLE', () => {
    expect(catalogueStatusLabel('PILOT')).toBe('Pilot');
    expect(catalogueStatusLabel('COMING_SOON')).toBe('Coming soon');
    expect(catalogueStatusLabel('AVAILABLE')).toBeNull();
  });

  it('names what a policy was sold as only for the two sellable statuses', () => {
    expect(soldUnderLabel('PILOT')).toBe('Pilot');
    expect(soldUnderLabel('AVAILABLE')).toBe('Generally available');
    expect(soldUnderLabel(null)).toBeNull();
    expect(soldUnderLabel('COMING_SOON')).toBeNull();
  });
});

describe('tluFor', () => {
  it("uses the catalogue item's factor", () => {
    expect(tluFor(findCatalogueItem(KE_CATALOGUE, 'LIVESTOCK', 'CAMEL'), 10)).toBe(14);
    expect(tluFor(findCatalogueItem(KE_CATALOGUE, 'LIVESTOCK', 'GOAT'), 25)).toBe(2.5);
  });

  it('is null, not zero, without an item or factor', () => {
    expect(tluFor(null, 10)).toBeNull();
    const maize = findCatalogueItem(KE_CATALOGUE, 'CROP', 'MAIZE');
    expect(tluFor(maize, 10)).toBeNull();
  });
});

describe('matchCatalogueItem', () => {
  const crops = catalogueItems(KE_CATALOGUE, 'CROP');

  it('matches by code or label, in any case and separator', () => {
    expect(matchCatalogueItem('MAIZE', crops)?.code).toBe('MAIZE');
    expect(matchCatalogueItem('Maize', crops)?.code).toBe('MAIZE');
    expect(matchCatalogueItem('green grams', crops)?.code).toBe('GREEN_GRAMS');
    expect(matchCatalogueItem(' Green-Grams ', crops)?.code).toBe('GREEN_GRAMS');
  });

  it('returns null for an unlisted, blank or non-string value', () => {
    expect(matchCatalogueItem('Tea', crops)).toBeNull();
    expect(matchCatalogueItem('', crops)).toBeNull();
    expect(matchCatalogueItem(42, crops)).toBeNull();
  });
});

describe('exampleItem', () => {
  it('prefers an AVAILABLE crop', () => {
    expect(exampleItem(KE_CATALOGUE, 'CROP')?.code).toBe('MAIZE');
  });

  it('falls back to the first sellable crop where nothing is AVAILABLE (Ghana is all pilot)', () => {
    expect(exampleItem(GH_CATALOGUE, 'CROP')?.code).toBe('MAIZE');
  });

  it('is null for an empty line or unknown market', () => {
    expect(exampleItem(GH_CATALOGUE, 'LIVESTOCK')).toBeNull();
    expect(exampleItem(null, 'CROP')).toBeNull();
  });
});

describe('notSellableReason', () => {
  it('is null for a sellable crop, and while the catalogue is unknown', () => {
    expect(notSellableReason(KE_CATALOGUE, 'CROP', 'SORGHUM')).toBeNull();
    expect(notSellableReason(null, 'CROP', 'TEA')).toBeNull();
  });

  it('explains a coming-soon crop, naming the country', () => {
    expect(notSellableReason(KE_CATALOGUE, 'CROP', 'WHEAT')).toMatch(/Wheat cover is coming soon in Kenya/);
  });

  it('explains a legacy crop the market never listed', () => {
    expect(notSellableReason(KE_CATALOGUE, 'CROP', 'TEA')).toMatch(
      /Tea is not in the Kenya product catalogue/,
    );
  });
});

describe('catalogueRefusalMessage', () => {
  it('words PRODUCT_NOT_OFFERED for a coming-soon item', () => {
    expect(
      catalogueRefusalMessage('PRODUCT_NOT_OFFERED', {
        countryCode: 'GH', line: 'CROP', item: 'COWPEA', status: 'COMING_SOON',
      }),
    ).toBe('Cowpea cover is coming soon in Ghana and cannot be quoted or sold yet.');
  });

  it('words PRODUCT_NOT_OFFERED for an item the market does not list', () => {
    expect(
      catalogueRefusalMessage('PRODUCT_NOT_OFFERED', {
        countryCode: 'KE', line: 'CROP', item: 'TEA', status: null,
      }),
    ).toBe('Tea cover is not offered in Kenya, so it cannot be quoted or sold.');
  });

  it('words PRODUCT_NOT_IN_MARKET for the record being created', () => {
    expect(
      catalogueRefusalMessage('PRODUCT_NOT_IN_MARKET', {
        countryCode: 'GH', line: 'CROP', item: 'TEA',
      }),
    ).toBe('Tea is not in the product list in Ghana, so a new plot cannot be registered with it. Choose one from the list.');
    expect(
      catalogueRefusalMessage('PRODUCT_NOT_IN_MARKET', {
        countryCode: 'KE', line: 'LIVESTOCK', item: 'POULTRY',
      }),
    ).toMatch(/Poultry is not in the product list in Kenya, so a new herd cannot be registered/);
  });

  it('does not say "Choose one from the list" in a market with no livestock list', () => {
    const message = catalogueRefusalMessage('PRODUCT_NOT_IN_MARKET', {
      countryCode: 'GH', line: 'LIVESTOCK', item: 'CATTLE',
    });
    expect(message).toBe('Livestock cover is not offered in Ghana, so no herd can be registered there.');
    expect(message).not.toMatch(/Choose/);
  });

  it('names every crop of a bulk refusal, not only the first', () => {
    expect(
      catalogueRefusalMessage('PRODUCT_NOT_IN_MARKET', {
        countryCode: 'GH', line: 'CROP', item: 'TEA', items: ['TEA', 'CASSAVA'],
        rows: [{ row: 1, cropType: 'TEA' }, { row: 3, cropType: 'CASSAVA' }],
      }),
    ).toBe('Tea, Cassava are not in the product list in Ghana, so plots cannot be registered with them. Choose from the list.');
  });

  it('words PRICING_NOT_CONFIGURED without implying a fault in the request', () => {
    expect(
      catalogueRefusalMessage('PRICING_NOT_CONFIGURED', { countryCode: 'GH', item: 'SOYBEAN' }),
    ).toMatch(/Pricing for soybean is not configured in Ghana yet/);
  });

  it('does not name a country it does not recognise', () => {
    expect(
      catalogueRefusalMessage('PRODUCT_NOT_OFFERED', { countryCode: 'ZZ', item: 'MAIZE' }),
    ).toMatch(/in your market/);
  });

  it('returns null for other codes, and for a refusal without its details object', () => {
    expect(catalogueRefusalMessage('CAPABILITY_NOT_ENABLED', {})).toBeNull();
    expect(catalogueRefusalMessage('PRODUCT_NOT_OFFERED', undefined)).toBeNull();
    expect(catalogueRefusalMessage('PRODUCT_NOT_OFFERED', [{ message: 'x' }])).toBeNull();
  });
});
