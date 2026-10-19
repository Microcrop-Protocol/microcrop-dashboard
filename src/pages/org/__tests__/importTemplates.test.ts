/**
 * Bulk-import templates and the pre-upload checks (farmers, plots, herds).
 *
 * A template is an instruction: every value in it must be one the organization's market accepts,
 * and an unknown market or catalogue must produce an EMPTY value rather than another market's.
 * The crop check names offending rows before upload, rewrites labels to the codes the API takes,
 * and sends `plotName` — the field the backend's bulk validator requires.
 */
import { describe, expect, it } from 'vitest';
import { MARKETS } from '@/lib/market';
import {
  GH_CATALOGUE,
  KE_CATALOGUE,
  NG_CATALOGUE,
  RW_CATALOGUE,
  TZ_CATALOGUE,
  UG_CATALOGUE,
  ZM_CATALOGUE,
} from '@/test/catalogue-fixtures';
import {
  BLANKET_CONSENT_MESSAGE,
  csvToJsonExample,
  farmerCsvTemplate,
  herdCsvTemplate,
  importableCrops,
  parsePlantingDate,
  plotCsvTemplate,
  prepareFarmerRows,
  prepareHerdRows,
  preparePlotRows,
} from '../importTemplates';
import {
  FARMER_REQUIRED,
  HERD_REQUIRED,
  PLOT_REQUIRED,
  normalizeFarmerHeader,
  normalizeHerdHeader,
  normalizePlotHeader,
  parseCsv,
} from '../csvImport';
import { buildErrorReport, parseBackendDetails } from '../importIssues';
import { ApiError } from '@/lib/api/client';

describe('templates', () => {
  it("uses the Kenyan market's phone, divisions, coordinates, season and its AVAILABLE crop code", () => {
    expect(farmerCsvTemplate(MARKETS.KE)).toBe(
      'firstName,lastName,phoneNumber,nationalId,county,subCounty,ward,village,kycStatus,' +
        'consentDocumentIds,consentMethod,consentGrantedAt,consentEvidenceRef,consentLocale\n' +
        'John,Doe,+254712345678,12345678,Nakuru,Nakuru East,Kinoo,Kinoo Village,PENDING,,,,,',
    );
    expect(plotCsvTemplate(MARKETS.KE, KE_CATALOGUE)).toBe(
      'farmerPhone,plotName,latitude,longitude,acreage,cropType,plantingDate\n' +
        '+254712345678,Plot A,-0.3031,36.08,2.5,MAIZE,2026-03-15',
    );
    expect(herdCsvTemplate(MARKETS.KE, KE_CATALOGUE)).toBe(
      'farmerPhone,name,livestockType,headCount,estimatedValue,latitude,longitude\n' +
        '+254712345678,Herd A,CATTLE,10,40000,-0.3031,36.08',
    );
  });

  it("uses Ghana's values, and a crop Ghana sells (all Ghana crops are pilot)", () => {
    expect(farmerCsvTemplate(MARKETS.GH).split('\n')[1]).toBe(
      'John,Doe,+233241234567,12345678,Ashanti,Kumasi Metropolitan,,,PENDING,,,,,',
    );
    expect(plotCsvTemplate(MARKETS.GH, GH_CATALOGUE).split('\n')[1]).toBe(
      '+233241234567,Plot A,6.6885,-1.6244,2.5,MAIZE,2026-04-15',
    );
  });

  it('has no herds template in Ghana, which lists no livestock', () => {
    expect(herdCsvTemplate(MARKETS.GH, GH_CATALOGUE)).toBe('');
    expect(herdCsvTemplate(MARKETS.GH, null)).toBe('');
  });

  it.each([
    ['UG', UG_CATALOGUE, 'John,Doe,+256770000123,12345678,Masindi,Pakanyi,,,PENDING,,,,,', '+256770000123,Plot A,1.6744,31.715,2.5,MAIZE,2026-03-20'],
    ['TZ', TZ_CATALOGUE, 'John,Doe,+255754000000,12345678,Iringa,Kilolo,,,PENDING,,,,,', '+255754000000,Plot A,-7.77,35.69,2.5,MAIZE,2025-12-01'],
    ['ZM', ZM_CATALOGUE, 'John,Doe,+260970000001,12345678,Eastern,Chipata,,,PENDING,,,,,', '+260970000001,Plot A,-13.64,32.65,2.5,MAIZE,2025-11-20'],
    ['NG', NG_CATALOGUE, 'John,Doe,+2348030000001,12345678,Kaduna,Zaria,,,PENDING,,,,,', '+2348030000001,Plot A,11.085,7.719,2.5,MAIZE,2026-06-01'],
    ['RW', RW_CATALOGUE, 'John,Doe,+250788000001,12345678,Eastern,Nyagatare,,,PENDING,,,,,', '+250788000001,Plot A,-1.3,30.33,2.5,MAIZE,2026-03-10'],
  ] as const)(
    "uses %s's own values, and a LISTED crop although nothing there is sellable yet",
    (code, catalogue, farmerRow, plotRow) => {
      const market = MARKETS[code];
      expect(farmerCsvTemplate(market).split('\n')[1]).toBe(farmerRow);
      expect(plotCsvTemplate(market, catalogue).split('\n')[1]).toBe(plotRow);
      // No livestock line in a hidden market: no herds template.
      expect(herdCsvTemplate(market, catalogue)).toBe('');
    },
  );

  it('still prefers a sellable crop where one exists', () => {
    // Coming-soon crops listed FIRST must not displace the first sellable one (GROUNDNUT, pilot).
    const comingSoonFirst = {
      ...GH_CATALOGUE,
      lines: { ...GH_CATALOGUE.lines, CROP: [...GH_CATALOGUE.lines.CROP].reverse() },
    };
    expect(plotCsvTemplate(MARKETS.GH, comingSoonFirst).split('\n')[1].split(',')[5]).toBe('GROUNDNUT');
  });

  it('leaves unknown values EMPTY rather than falling back to Kenya', () => {
    expect(farmerCsvTemplate(null).split('\n')[1]).toBe('John,Doe,,12345678,,,,,PENDING,,,,,');
    expect(plotCsvTemplate(null, null).split('\n')[1]).toBe(',Plot A,,,2.5,,');
    expect(herdCsvTemplate(null, null).split('\n')[1]).toBe(',Herd A,,10,,,');
  });

  it('derives the JSON example from the CSV template', () => {
    expect(csvToJsonExample(plotCsvTemplate(MARKETS.KE, KE_CATALOGUE))).toBe(
      '[{"farmerPhone": "+254712345678", "plotName": "Plot A", "latitude": -0.3031, "longitude": 36.08, ' +
        '"acreage": 2.5, "cropType": "MAIZE", "plantingDate": "2026-03-15"}]',
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

/**
 * A template is only an instruction if following it works: for each market, every template must
 * parse with its own header normalizer and required set, pass its preparer with zero issues, and
 * produce a JSON example that parses.
 */
describe.each([
  ['KE', MARKETS.KE, KE_CATALOGUE],
  ['GH', MARKETS.GH, GH_CATALOGUE],
  ['UG', MARKETS.UG, UG_CATALOGUE],
  ['TZ', MARKETS.TZ, TZ_CATALOGUE],
  ['ZM', MARKETS.ZM, ZM_CATALOGUE],
  ['NG', MARKETS.NG, NG_CATALOGUE],
  ['RW', MARKETS.RW, RW_CATALOGUE],
] as const)('templates round-trip in %s', (_code, market, catalogue) => {
  it('farmers template parses, prepares cleanly, and its JSON example parses', () => {
    const csv = farmerCsvTemplate(market);
    const { rows, error } = parseCsv(csv, { normalizeHeader: normalizeFarmerHeader, required: FARMER_REQUIRED });
    expect(error).toBeUndefined();
    const { rows: prepared, blocking } = prepareFarmerRows(rows, market);
    expect(blocking).toBeNull();
    expect(prepared[0]).toMatchObject({ phoneNumber: market.phoneExample, kycStatus: 'PENDING' });
    expect(prepared[0]).not.toHaveProperty('consent');
    const json = JSON.parse(csvToJsonExample(csv));
    expect(prepareFarmerRows(json, market).blocking).toBeNull();
  });

  it('plots template parses, prepares cleanly, and its JSON example parses', () => {
    const csv = plotCsvTemplate(market, catalogue);
    const { rows, error } = parseCsv(csv, { normalizeHeader: normalizePlotHeader, required: PLOT_REQUIRED });
    expect(error).toBeUndefined();
    const { rows: prepared, blocking } = preparePlotRows(rows, catalogue);
    expect(blocking).toBeNull();
    expect(prepared[0]).toMatchObject({ plotName: 'Plot A', cropType: 'MAIZE', acreage: 2.5 });
    expect(prepared[0].plantingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const json = JSON.parse(csvToJsonExample(csv));
    expect(preparePlotRows(json, catalogue).blocking).toBeNull();
  });

  it('herds template follows the market: clean in Kenya, absent and blocked in Ghana', () => {
    const csv = herdCsvTemplate(market, catalogue);
    if (!market.livestockEnabled) {
      expect(csv).toBe('');
      const { blocking } = prepareHerdRows(
        [{ farmerPhone: market.phoneExample, name: 'Herd A', livestockType: 'CATTLE', headCount: 10, estimatedValue: 100 }],
        catalogue,
        market,
      );
      expect(blocking?.title).toBe(`Livestock cover is not offered in ${market.countryName}`);
      return;
    }
    const { rows, error } = parseCsv(csv, { normalizeHeader: normalizeHerdHeader, required: HERD_REQUIRED });
    expect(error).toBeUndefined();
    const { rows: prepared, blocking } = prepareHerdRows(rows, catalogue, market);
    expect(blocking).toBeNull();
    expect(prepared[0]).toMatchObject({ name: 'Herd A', livestockType: 'CATTLE', headCount: 10, estimatedValue: 40000 });
    const json = JSON.parse(csvToJsonExample(csv));
    expect(prepareHerdRows(json, catalogue, market).blocking).toBeNull();
  });
});

describe('prepareFarmerRows', () => {
  const farmer = (extra: Record<string, unknown> = {}) => ({
    firstName: 'Wanjiru', lastName: 'Kamau', phoneNumber: '0712345678', nationalId: '12345678', county: 'Nakuru', ...extra,
  });
  const consent = {
    consentDocumentIds: 'FARMER_DATA_PROCESSING; FARMER_POLICY_TERMS',
    consentMethod: 'In person signature',
    consentGrantedAt: '2026-05-01',
    consentEvidenceRef: 'FORM-001',
  };

  it('sends the phone as typed: the server normalises it to the market', () => {
    const { rows, blocking } = prepareFarmerRows([farmer(), farmer({ phoneNumber: '+254 712 345 678' })], MARKETS.KE);
    expect(blocking).toBeNull();
    expect(rows.map((r) => r.phoneNumber)).toEqual(['0712345678', '+254 712 345 678']);
  });

  it('accepts a name the wizard regex would refuse (no ASCII-letter rule on import)', () => {
    expect(prepareFarmerRows([farmer({ firstName: 'Ngũgĩ' })], MARKETS.KE).blocking).toBeNull();
  });

  it('applies the onboarding rules: names 2–50, nationalId 6–20, required fields', () => {
    const { rows, blocking } = prepareFarmerRows(
      [
        farmer({ nationalId: '12345' }),
        farmer({ nationalId: '1'.repeat(21) }),
        farmer({ firstName: 'J' }),
        farmer({ county: '' }),
      ],
      MARKETS.GH,
    );
    expect(rows).toEqual([]);
    expect(blocking?.title).toBe('Fix 4 rows before importing');
    expect(blocking?.issues).toEqual([
      'Row 1 · nationalId: National ID must be at least 6 characters',
      'Row 2 · nationalId: National ID must not exceed 20 characters',
      'Row 3 · firstName: First name must be at least 2 characters',
      // Ghana calls the county column Region.
      'Row 4 · county: Region is required',
    ]);
  });

  it('passes kycStatus PENDING/APPROVED (any case), drops a blank one, refuses anything else', () => {
    const ok = prepareFarmerRows([farmer({ kycStatus: 'approved' }), farmer({ kycStatus: '' })], MARKETS.KE);
    expect(ok.rows[0].kycStatus).toBe('APPROVED');
    expect(ok.rows[1]).not.toHaveProperty('kycStatus');
    expect(prepareFarmerRows([farmer({ kycStatus: 'VERIFIED' })], MARKETS.KE).blocking?.issues[0]).toMatch(
      /kycStatus must be PENDING or APPROVED/,
    );
  });

  it('folds a full set of consent columns into the nested consent object', () => {
    const { rows, blocking } = prepareFarmerRows([farmer({ ...consent, consentLocale: 'sw' })], MARKETS.KE);
    expect(blocking).toBeNull();
    expect(rows[0].consent).toEqual({
      documentIds: ['FARMER_DATA_PROCESSING', 'FARMER_POLICY_TERMS'],
      method: 'IN_PERSON_SIGNATURE',
      grantedAt: '2026-05-01',
      evidenceRef: 'FORM-001',
      locale: 'sw',
    });
    expect(rows[0]).not.toHaveProperty('consentMethod');
  });

  it('omits consent when every consent column is empty', () => {
    const empty = { consentDocumentIds: '', consentMethod: '', consentGrantedAt: '', consentEvidenceRef: '', consentLocale: '' };
    const { rows, blocking } = prepareFarmerRows([farmer(empty)], MARKETS.KE);
    expect(blocking).toBeNull();
    expect(rows[0]).not.toHaveProperty('consent');
  });

  it('refuses a partial consent record by row', () => {
    const { blocking } = prepareFarmerRows([farmer({ ...consent, consentEvidenceRef: '' })], MARKETS.KE);
    expect(blocking?.issues[0]).toMatch(/^Row 1 · consent: Consent is incomplete — missing consentEvidenceRef/);
  });

  it('checks consent document ids, method and date against what the server accepts', () => {
    const { rows, blocking } = prepareFarmerRows(
      [
        farmer({ ...consent, consentDocumentIds: 'FARMER_DATA_PROCESSING; MARKETING' }),
        farmer({ ...consent, consentMethod: 'Email' }),
        farmer({ ...consent, consentGrantedAt: '2999-01-01' }),
        farmer({ ...consent, consentGrantedAt: '01/05/2026' }),
      ],
      MARKETS.KE,
    );
    expect(rows).toEqual([]);
    expect(blocking?.issues).toEqual([
      'Row 1 · consentDocumentIds: Unknown consent document MARKETING. Use FARMER_DATA_PROCESSING and/or FARMER_POLICY_TERMS',
      expect.stringMatching(/^Row 2 · consentMethod: "Email" is not a consent method — use one of IN_PERSON_VERBAL_ATTESTED, /),
      'Row 3 · consentGrantedAt: 2999-01-01 is in the future — consent is dated when the farmer gave it',
      'Row 4 · consentGrantedAt: "01/05/2026" is not a date — use YYYY-MM-DD',
    ]);
  });

  it('uppercases and de-duplicates consent document ids', () => {
    const { rows, blocking } = prepareFarmerRows(
      [farmer({ ...consent, consentDocumentIds: 'farmer_data_processing;FARMER_DATA_PROCESSING' })],
      MARKETS.KE,
    );
    expect(blocking).toBeNull();
    expect(rows[0].consent).toMatchObject({ documentIds: ['FARMER_DATA_PROCESSING'] });
  });

  it('passes a JSON row’s nested consent object through', () => {
    const nested = { documentIds: ['FARMER_DATA_PROCESSING'], method: 'WEB_FORM', grantedAt: '2026-05-01', evidenceRef: 'x' };
    expect(prepareFarmerRows([farmer({ consent: nested })], MARKETS.KE).rows[0].consent).toEqual(nested);
  });

  it('blocks a blanket consented column with the backend wording', () => {
    const { rows, blocking } = prepareFarmerRows([farmer({ Consented: 'yes' })], MARKETS.KE);
    expect(rows).toEqual([]);
    expect(blocking?.issues).toEqual([BLANKET_CONSENT_MESSAGE]);
    expect(prepareFarmerRows([farmer({ hasConsent: true })], MARKETS.KE).blocking).not.toBeNull();
  });
});

describe('preparePlotRows', () => {
  const row = (cropType: unknown, extra: Record<string, unknown> = {}) => ({
    farmerPhone: '+254712345678', name: 'Plot A', latitude: -0.3, longitude: 36.08, acreage: 2.5, cropType, ...extra,
  });

  it('rewrites crop labels to codes and sends plotName', () => {
    const { rows, blocking } = preparePlotRows([row('Maize'), row('green grams')], KE_CATALOGUE);
    expect(blocking).toBeNull();
    expect(rows[0]).toMatchObject({ plotName: 'Plot A', cropType: 'MAIZE' });
    expect(rows[1]).toMatchObject({ cropType: 'GREEN_GRAMS' });
    expect(rows[0]).not.toHaveProperty('name');
  });

  it('keeps an explicit plotName over name', () => {
    const { rows } = preparePlotRows([row('MAIZE', { plotName: 'East' })], KE_CATALOGUE);
    expect(rows[0]).toMatchObject({ plotName: 'East' });
  });

  it('lets a coming-soon crop through: it is listed, so the server accepts the plot', () => {
    const { rows, blocking } = preparePlotRows([row('Wheat')], KE_CATALOGUE);
    expect(blocking).toBeNull();
    expect(rows[0]).toMatchObject({ cropType: 'WHEAT' });
  });

  it('coerces CSV strings to numbers', () => {
    const { rows } = preparePlotRows([row('MAIZE', { latitude: '-0.30', longitude: '36.08', acreage: '2.5' })], KE_CATALOGUE);
    expect(rows[0]).toMatchObject({ latitude: -0.3, longitude: 36.08, acreage: 2.5 });
  });

  it('links by farmerNationalId, and drops a blank farmerPhone', () => {
    const { rows, blocking } = preparePlotRows(
      [row('MAIZE', { farmerPhone: '', farmerNationalId: '12345678' })],
      KE_CATALOGUE,
    );
    expect(blocking).toBeNull();
    expect(rows[0]).toMatchObject({ farmerNationalId: '12345678' });
    expect(rows[0]).not.toHaveProperty('farmerPhone');
  });

  it('requires one farmer key', () => {
    const { blocking } = preparePlotRows([row('MAIZE', { farmerPhone: '' })], KE_CATALOGUE);
    expect(blocking?.issues).toEqual(['Row 1 · farmerPhone: farmerPhone or farmerNationalId is required']);
  });

  it('refuses (0,0) but accepts longitude 0 with a real latitude (Ghana, on the meridian)', () => {
    expect(preparePlotRows([row('MAIZE', { latitude: 0, longitude: 0 })], KE_CATALOGUE).blocking?.issues).toEqual([
      'Row 1 · latitude: coordinates 0,0 are not a real location',
    ]);
    expect(preparePlotRows([row('MAIZE', { latitude: 5.6, longitude: 0 })], GH_CATALOGUE).blocking).toBeNull();
  });

  it('applies the wizard ranges: acreage 0.1–10000, latitude ±90, plot name 2+', () => {
    const { blocking } = preparePlotRows(
      [row('MAIZE', { acreage: 0.05 }), row('MAIZE', { latitude: 91 }), row('MAIZE', { name: 'A' }), row('MAIZE', { acreage: 'two' })],
      KE_CATALOGUE,
    );
    expect(blocking?.issues).toEqual([
      'Row 1 · acreage: Acreage must be at least 0.1',
      'Row 2 · latitude: Latitude must be between -90 and 90',
      'Row 3 · plotName: Plot name must be at least 2 characters',
      'Row 4 · acreage: Acreage must be a number',
    ]);
  });

  it('sends plantingDate as ISO, omits a blank one, and refuses an unreadable one', () => {
    const { rows } = preparePlotRows(
      [row('MAIZE', { plantingDate: '2026-03-15' }), row('MAIZE', { plantingDate: '15/03/2026' }), row('MAIZE', { plantingDate: '' })],
      KE_CATALOGUE,
    );
    expect(rows[0].plantingDate).toBe('2026-03-15');
    expect(rows[1].plantingDate).toBe('2026-03-15');
    expect(rows[2]).not.toHaveProperty('plantingDate');
    expect(preparePlotRows([row('MAIZE', { plantingDate: 'March' })], KE_CATALOGUE).blocking?.issues[0]).toMatch(
      /plantingDate: "March" is not a date — use YYYY-MM-DD/,
    );
  });

  it('blocks the upload and names every row with an unlisted crop', () => {
    const { rows, blocking } = preparePlotRows(
      [row('MAIZE'), row('Tea'), row('Tea'), row('')],
      KE_CATALOGUE,
    );
    expect(rows).toEqual([]);
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
    const { rows, blocking } = preparePlotRows([row('MAIZE')], null);
    expect(rows).toEqual([]);
    expect(blocking?.title).toBe('Crop list unavailable');
    expect(preparePlotRows([row('MAIZE')], null, 'unknown').blocking?.summary).toMatch(/couldn't load/);
  });

  it('says the list is still LOADING while it loads — not that it failed', () => {
    const { rows, blocking } = preparePlotRows([row('MAIZE')], null, 'loading');
    expect(rows).toEqual([]);
    expect(blocking?.title).toBe('Crop list still loading');
    expect(blocking?.tone).toBe('warning');
    expect(blocking?.summary).toMatch(/still loading/);
    expect(blocking?.summary).not.toMatch(/couldn't load/);
  });
});

describe('parsePlantingDate', () => {
  it('reads ISO and unambiguous day-first dates, and refuses the ambiguous ones', () => {
    expect(parsePlantingDate('2026-3-5')).toEqual({ iso: '2026-03-05' });
    expect(parsePlantingDate('2026-03-15T00:00:00Z')).toEqual({ iso: '2026-03-15' });
    expect(parsePlantingDate('3/15/2026')).toEqual({ iso: '2026-03-15' });
    expect(parsePlantingDate('03/04/2026')).toEqual({ error: expect.stringMatching(/day\/month or month\/day/) });
    expect(parsePlantingDate('2026-02-30')).toEqual({ error: expect.stringMatching(/not a date/) });
    expect(parsePlantingDate('')).toBeNull();
  });
});

describe('prepareHerdRows', () => {
  const herd = (extra: Record<string, unknown> = {}) => ({
    farmerPhone: '+254712345678', name: 'Herd A', livestockType: 'Goat', headCount: '10', estimatedValue: '5000', ...extra,
  });

  it('matches the livestock type to the code, coerces numbers, and drops server-derived fields', () => {
    const { rows, blocking } = prepareHerdRows(
      [herd({ insuranceUnitId: 'u1', season: 'LRLD', tluCount: 1, herdId: 'h1' })],
      KE_CATALOGUE,
      MARKETS.KE,
    );
    expect(blocking).toBeNull();
    expect(rows[0]).toEqual({ farmerPhone: '+254712345678', name: 'Herd A', livestockType: 'GOAT', headCount: 10, estimatedValue: 5000 });
  });

  it('refuses POULTRY, which Kenya does not list', () => {
    const { blocking } = prepareHerdRows([herd({ livestockType: 'POULTRY' })], KE_CATALOGUE, MARKETS.KE);
    expect(blocking?.issues).toEqual(['Row 1 · livestockType: "POULTRY" is not in the Kenya livestock list']);
  });

  it('applies the onboarding headCount rule and a positive value', () => {
    const { blocking } = prepareHerdRows(
      [herd({ headCount: 0 }), herd({ headCount: 100001 }), herd({ headCount: 1.5 }), herd({ estimatedValue: 0 })],
      KE_CATALOGUE,
      MARKETS.KE,
    );
    expect(blocking?.issues).toEqual([
      'Row 1 · headCount: Must have at least 1 animal',
      'Row 2 · headCount: Head count must not exceed 100,000',
      'Row 3 · headCount: Head count must be a whole number',
      'Row 4 · estimatedValue: Estimated value per head must be greater than 0',
    ]);
  });

  it('takes optional coordinates, refusing (0,0)', () => {
    expect(prepareHerdRows([herd({ latitude: '2.1', longitude: '36.5' })], KE_CATALOGUE, MARKETS.KE).rows[0]).toMatchObject({
      latitude: 2.1, longitude: 36.5,
    });
    expect(prepareHerdRows([herd({ latitude: 0, longitude: 0 })], KE_CATALOGUE, MARKETS.KE).blocking).not.toBeNull();
    const half = prepareHerdRows([herd({ latitude: '2.1' })], KE_CATALOGUE, MARKETS.KE);
    expect(half.rows).toEqual([]);
    expect(half.blocking?.issues).toEqual(['Row 1 · longitude: Give both latitude and longitude, or leave both empty']);
  });

  it('blocks a market with no livestock, and holds while the catalogue loads', () => {
    expect(prepareHerdRows([herd()], GH_CATALOGUE, MARKETS.GH).blocking?.title).toBe('Livestock cover is not offered in Ghana');
    expect(prepareHerdRows([herd()], null, MARKETS.KE, 'loading').blocking?.title).toBe('Livestock list still loading');
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
