/**
 * MAPPING A PER-MARKET DOCUMENT CODE TO ITS MULTIPART FIELD NAME.
 *
 * The backend derives this map in `uploadFieldMap()` (config/kyb-documents.js): camelCase of the
 * document code, plus the legacy Kenya field names kept as explicit aliases because the shipped
 * dashboard sends them. This file is the mirror of that derivation, and it is a derivation rather
 * than a table for the same reason: a new market's documents become uploadable with NO edit here.
 *
 * The old dashboard carried a hand-written `FIELD_FOR` table of ten entries. A market whose
 * documents were not in it produced a silent failure of the worst shape: the file was dropped on
 * the way out (no field name, so `fd.append` was skipped), the submit succeeded, and the backend
 * then rejected it for a missing required document the partner had just uploaded.
 *
 * THE ALIASES ARE LOAD-BEARING AND MUST NOT BE "SIMPLIFIED". `TAX_CERTIFICATE` camelCases to
 * `taxCertificate`, but the field the backend accepts is `taxPinCert`; `BUSINESS_REGISTRATION` to
 * `businessRegistration`, but the field is `businessRegistrationCert`. Deriving alone would break
 * both live markets' required documents.
 */

/**
 * Codes whose multipart field name is NOT the camelCase of the code. Exactly the legacy set the
 * backend lists as aliases — keep the two in agreement.
 */
const LEGACY_FIELD_NAMES: Record<string, string> = {
  BUSINESS_REGISTRATION: 'businessRegistrationCert',
  TAX_CERTIFICATE: 'taxPinCert',
  IRA_LICENSE: 'iraLicenseCert',
  NIC_LICENSE: 'nicLicenseCert',
  OTHER: 'otherDocument',
};

/** `NG_NAICOM_LICENSE` → `ngNaicomLicense`. The backend's derivation, character for character. */
function camelCaseCode(code: string): string {
  return code.toLowerCase().replace(/_([a-z])/g, (_match, c: string) => c.toUpperCase());
}

/**
 * The multipart field name for a document code.
 *
 * Returns null for an empty code rather than a field name that would silently collide. Every
 * other code gets a name, including one this build has never seen — which is the point: the
 * backend accepts every derived name, so an unknown-to-the-dashboard document still uploads.
 */
export function uploadFieldForCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  if (!key) return null;
  return LEGACY_FIELD_NAMES[key] ?? camelCaseCode(key);
}
