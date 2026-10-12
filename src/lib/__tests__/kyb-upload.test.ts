/**
 * DOCUMENT CODE → MULTIPART FIELD NAME.
 *
 * This mapping is silent when it is wrong, which is why it has its own test. The failure shape is
 * the worst available: no field name means `fd.append` is skipped, the file is dropped on the way
 * out, the POST SUCCEEDS, and the backend then rejects the submission for a missing required
 * document the partner just uploaded. Nothing in the UI says a file was lost.
 *
 * So two things are pinned:
 *
 *   THE LEGACY ALIASES ARE EXACT. `TAX_CERTIFICATE` camelCases to `taxCertificate`, but the field
 *   the backend accepts is `taxPinCert`. Deriving alone would break both live markets' required
 *   documents, and "simplifying away" the alias table is the obvious wrong refactor.
 *
 *   AN UNKNOWN CODE STILL GETS A NAME. The backend derives a field for every code in its
 *   registry, so a market this dashboard build has never heard of is still uploadable. A table
 *   lookup returning undefined was the old behaviour and is the bug above.
 */
import { describe, it, expect } from 'vitest';
import { uploadFieldForCode } from '@/lib/kyb-upload';

describe('legacy field names the backend accepts verbatim', () => {
  it.each([
    ['BUSINESS_REGISTRATION', 'businessRegistrationCert'],
    ['TAX_CERTIFICATE', 'taxPinCert'],
    ['IRA_LICENSE', 'iraLicenseCert'],
    ['NIC_LICENSE', 'nicLicenseCert'],
    ['OTHER', 'otherDocument'],
  ])('%s -> %s', (code, field) => {
    expect(uploadFieldForCode(code)).toBe(field);
  });

  it('does not camelCase a code that has an alias', () => {
    // The camelCase of TAX_CERTIFICATE is `taxCertificate`, which the backend does not accept.
    expect(uploadFieldForCode('TAX_CERTIFICATE')).not.toBe('taxCertificate');
  });
});

describe('codes whose field name IS the camelCase', () => {
  it.each([
    ['DIRECTOR_ID', 'directorId'],
    ['PROOF_OF_ADDRESS', 'proofOfAddress'],
    ['BANK_STATEMENT', 'bankStatement'],
    ['CERTIFICATE_OF_INCORPORATION', 'certificateOfIncorporation'],
    ['GHANA_TIN', 'ghanaTin'],
  ])('%s -> %s', (code, field) => {
    expect(uploadFieldForCode(code)).toBe(field);
  });
});

describe('a code this build has never seen', () => {
  it('still produces a field name rather than dropping the file', () => {
    // The backend derives `ngNaicomLicense` for this code with no edit anywhere, which is the
    // whole point of the three-layer document model.
    expect(uploadFieldForCode('NG_NAICOM_LICENSE')).toBe('ngNaicomLicense');
  });

  it('handles a single-word code', () => {
    expect(uploadFieldForCode('PASSPORT')).toBe('passport');
  });

  it('handles three or more segments', () => {
    expect(uploadFieldForCode('A_B_C_D')).toBe('aBCD');
  });
});

describe('input hygiene', () => {
  it('normalises case and surrounding whitespace', () => {
    expect(uploadFieldForCode(' tax_certificate ')).toBe('taxPinCert');
    expect(uploadFieldForCode('director_id')).toBe('directorId');
  });

  it('returns null for an empty or absent code rather than a colliding field name', () => {
    expect(uploadFieldForCode('')).toBeNull();
    expect(uploadFieldForCode('   ')).toBeNull();
    expect(uploadFieldForCode(null)).toBeNull();
    expect(uploadFieldForCode(undefined)).toBeNull();
  });

  it('never returns the same field name for two different codes in the live markets', () => {
    const codes = [
      'BUSINESS_REGISTRATION',
      'TAX_CERTIFICATE',
      'DIRECTOR_ID',
      'PROOF_OF_ADDRESS',
      'BANK_STATEMENT',
      'IRA_LICENSE',
      'NIC_LICENSE',
      'CERTIFICATE_OF_INCORPORATION',
      'GHANA_TIN',
      'OTHER',
    ];
    const fields = codes.map(uploadFieldForCode);
    expect(new Set(fields).size).toBe(codes.length);
  });
});
