/**
 * Bulk-import templates and the pre-upload crop check.
 *
 * A template is an instruction: every value in it must be one the organization's market accepts,
 * and an unknown market or catalogue must produce an EMPTY value rather than another market's.
 * The crop check names offending rows before upload, rewrites labels to the codes the API takes,
 * and sends `plotName` — the field the backend's bulk validator requires.
 */
import { describe, expect, it } from 'vitest';
import { MARKETS } from '@/lib/market';
import { GH_CATALOGUE, KE_CATALOGUE } from '@/test/catalogue-fixtures';
import {
  csvToJsonExample,
  farmerCsvTemplate,
  importableCrops,
  plotCsvTemplate,
  preparePlotRows,
} from '../importTemplates';
import { buildErrorReport, parseBackendDetails } from '../importIssues';
import { ApiError } from '@/lib/api/client';

describe('templates', () => {
  it("uses the Kenyan market's phone, division, coordinates and its AVAILABLE crop code", () => {
    expect(farmerCsvTemplate(MARKETS.KE).split('\n')[1]).toBe('John,Doe,+254712345678,12345678,Nakuru');
    expect(plotCsvTemplate(MARKETS.KE, KE_CATALOGUE)).toBe(
      'farmerPhone,plotName,latitude,longitude,acreage,cropType\n+254712345678,Plot A,-0.3031,36.08,2.5,MAIZE',
    );
  });

  it("uses Ghana's values, and a crop Ghana sells (all Ghana crops are pilot)", () => {
    expect(farmerCsvTemplate(MARKETS.GH).split('\n')[1]).toBe('John,Doe,+233241234567,12345678,Ashanti');
    expect(plotCsvTemplate(MARKETS.GH, GH_CATALOGUE).split('\n')[1]).toBe(
      '+233241234567,Plot A,6.6885,-1.6244,2.5,MAIZE',
    );
  });

  it('leaves unknown values EMPTY rather than falling back to Kenya', () => {
    expect(farmerCsvTemplate(null).split('\n')[1]).toBe('John,Doe,,12345678,');
    expect(plotCsvTemplate(null, null).split('\n')[1]).toBe(',Plot A,,,2.5,');
  });

  it('derives the JSON example from the CSV template', () => {
    expect(csvToJsonExample(plotCsvTemplate(MARKETS.KE, KE_CATALOGUE))).toBe(
      '[{"farmerPhone": "+254712345678", "plotName": "Plot A", "latitude": -0.3031, "longitude": 36.08, "acreage": 2.5, "cropType": "MAIZE"}]',
    );
  });

  it('groups the importable crop codes into sellable and not insurable yet', () => {
    const { sellable, notInsurableYet } = importableCrops(GH_CATALOGUE);
    expect(sellable.map((c) => c.code)).toEqual(['MAIZE', 'SOYBEAN', 'SORGHUM', 'GROUNDNUT']);
    expect(notInsurableYet.map((c) => c.code)).toEqual(['MILLET', 'COWPEA', 'RICE']);
  });

  it("files a pilot crop the SERVER has not priced as not insurable yet, not as sellable", () => {
    const catalogue = {
      ...GH_CATALOGUE,
      lines: {
        ...GH_CATALOGUE.lines,
        CROP: GH_CATALOGUE.lines.CROP.map((c) =>
          c.code === 'GROUNDNUT' ? { ...c, sellable: false, reason: 'PRICING_NOT_CONFIGURED' } : c,
        ),
      },
    };
    const { sellable, notInsurableYet } = importableCrops(catalogue);
    expect(sellable.map((c) => c.code)).not.toContain('GROUNDNUT');
    expect(notInsurableYet.map((c) => c.code)).toContain('GROUNDNUT');
  });
});

describe('preparePlotRows', () => {
  const row = (cropType: unknown, extra: Record<string, unknown> = {}) => ({
    farmerPhone: '+254712345678', name: 'Plot A', latitude: -0.3, longitude: 36.08, acreage: 2.5, cropType, ...extra,
  });

  it('rewrites crop labels to codes and sends plotName', () => {
    const { plots, blocking } = preparePlotRows([row('Maize'), row('green grams')], KE_CATALOGUE);
    expect(blocking).toBeNull();
    expect(plots[0]).toMatchObject({ plotName: 'Plot A', cropType: 'MAIZE' });
    expect(plots[1]).toMatchObject({ cropType: 'GREEN_GRAMS' });
    expect(plots[0]).not.toHaveProperty('name');
  });

  it('keeps an explicit plotName over name', () => {
    const { plots } = preparePlotRows([row('MAIZE', { plotName: 'East' })], KE_CATALOGUE);
    expect(plots[0]).toMatchObject({ plotName: 'East' });
  });

  it('lets a coming-soon crop through: it is listed, so the server accepts the plot', () => {
    const { plots, blocking } = preparePlotRows([row('Wheat')], KE_CATALOGUE);
    expect(blocking).toBeNull();
    expect(plots[0]).toMatchObject({ cropType: 'WHEAT' });
  });

  it('blocks the upload and names every row with an unlisted crop', () => {
    const { plots, blocking } = preparePlotRows(
      [row('MAIZE'), row('Tea'), row('Tea'), row('')],
      KE_CATALOGUE,
    );
    expect(plots).toEqual([]);
    expect(blocking?.tone).toBe('error');
    expect(blocking?.title).toBe('Crops not offered in Kenya');
    expect(blocking?.summary).toMatch(/^3 rows use a crop/);
    expect(blocking?.issues).toEqual([
      '2 rows · cropType: "Tea" is not in the Kenya crop list',
      'Row 4 · cropType: A blank crop is not in the Kenya crop list',
    ]);
  });

  it("blocks another market's crop (Ghana does not list green grams)", () => {
    const { blocking } = preparePlotRows([row('GREEN_GRAMS')], GH_CATALOGUE);
    expect(blocking?.issues[0]).toMatch(/not in the Ghana crop list/);
  });

  it('holds the file when the catalogue is unknown rather than sending it unchecked', () => {
    const { plots, blocking } = preparePlotRows([row('MAIZE')], null);
    expect(plots).toEqual([]);
    expect(blocking?.title).toBe('Crop list unavailable');
    expect(preparePlotRows([row('MAIZE')], null, 'unknown').blocking?.summary).toMatch(/couldn't load/);
  });

  it('says the list is still LOADING while it loads — not that it failed', () => {
    const { plots, blocking } = preparePlotRows([row('MAIZE')], null, 'loading');
    expect(plots).toEqual([]);
    expect(blocking?.title).toBe('Crop list still loading');
    expect(blocking?.tone).toBe('warning');
    expect(blocking?.summary).toMatch(/still loading/);
    expect(blocking?.summary).not.toMatch(/couldn't load/);
  });
});

describe('import report for catalogue refusals', () => {
  it('words a whole-file PRODUCT_NOT_IN_MARKET with the catalogue copy', () => {
    const err = new ApiError('Product not in market', 400, 'PRODUCT_NOT_IN_MARKET', undefined, {
      countryCode: 'KE', line: 'CROP', item: 'TEA',
    });
    const report = buildErrorReport(err, 'plots');
    expect(report.title).toBe("Not in your market's product list");
    expect(report.summary).toMatch(/Tea is not in the product list in Kenya/);
  });

  it("keeps the bulk refusal's per-row detail (details.rows) in the report", () => {
    // farmer.service.bulkImportPlots refuses the whole file and names every row, 1-based.
    const err = new ApiError('Not in market', 400, 'PRODUCT_NOT_IN_MARKET', undefined, {
      countryCode: 'GH', line: 'CROP', item: 'TEA', status: null,
      items: ['TEA', 'CASSAVA'],
      rows: [{ row: 2, cropType: 'TEA' }, { row: 5, cropType: 'TEA' }, { row: 7, cropType: 'CASSAVA' }],
    });
    const report = buildErrorReport(err, 'plots');
    expect(report.summary).toMatch(/Tea, Cassava are not in the product list in Ghana/);
    expect(report.issues).toEqual([
      '2 rows · cropType: "TEA" is not in the Ghana crop list',
      'Row 7 · cropType: "CASSAVA" is not in the Ghana crop list',
    ]);
  });

  it('falls back to one line per refused code when the refusal names no rows', () => {
    const err = new ApiError('Not in market', 400, 'PRODUCT_NOT_IN_MARKET', undefined, {
      countryCode: 'KE', line: 'CROP', item: 'TEA', items: ['TEA'],
    });
    expect(buildErrorReport(err, 'plots').issues).toEqual(['cropType: "TEA" is not in the Kenya crop list']);
  });

  it('does not throw on an object-shaped details', () => {
    expect(parseBackendDetails({ countryCode: 'KE' } as never)).toEqual([]);
  });
});
