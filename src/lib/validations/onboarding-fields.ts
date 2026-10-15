import { z } from 'zod';

/**
 * FIELD RULES SHARED BY ONBOARDING AND BULK IMPORT.
 *
 * Bulk import is an alternative to the farmer and livestock onboarding wizards: a partner that
 * already holds its farmers, plots and herds sends them as a file instead of typing them in. The
 * two paths must agree on what a valid record is, or a record the wizard would refuse arrives by
 * file (or the reverse). So each rule lives here once, and both the wizard schemas
 * (onboarding.ts, livestock-onboarding.ts) and the import preparers (pages/org/importTemplates.ts)
 * build from it.
 *
 * Mirrors microcrop-backend/src/validators/onboarding-fields.js. The server is the authority; this
 * file only lets the dashboard name a bad row before the upload instead of after it.
 *
 * Deliberately NOT here:
 *   - the wizard's ASCII-letter rule on names. The server does not apply it, and it would reject
 *     names like "Ngũgĩ" from a partner file. The wizard keeps it on top of these fields.
 *   - the wizard's "latitude/longitude must not be 0" refinements. Longitude 0 is a real place in
 *     Ghana (the Greenwich meridian runs through Tema); only the (0,0) pair is refused, by
 *     `isNullIsland`.
 * Values are not trimmed here (that would change what the wizard stores); the import preparers
 * trim before they parse.
 */

export const personNameField = (label: string) =>
  z.string()
    .min(2, `${label} must be at least 2 characters`)
    .max(50, `${label} must not exceed 50 characters`);

export const nationalIdField = z.string()
  .min(6, 'National ID must be at least 6 characters')
  .max(20, 'National ID must not exceed 20 characters');

export const plotNameField = z.string()
  .min(2, 'Plot name must be at least 2 characters')
  .max(100, 'Plot name must not exceed 100 characters');

export const latitudeField = z.number({ invalid_type_error: 'Latitude must be a number' })
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90');

export const longitudeField = z.number({ invalid_type_error: 'Longitude must be a number' })
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180');

/** In ACRES — the unit the backend prices in. Hectare columns are converted before this runs. */
export const acreageField = z.number({ invalid_type_error: 'Acreage must be a number' })
  .min(0.1, 'Acreage must be at least 0.1')
  .max(10000, 'Acreage must not exceed 10,000');

/** Server parity (1–100). The livestock wizard asks for 2 on top of this. */
export const herdNameField = z.string()
  .min(1, 'Herd name is required')
  .max(100, 'Herd name must not exceed 100 characters');

export const headCountField = z.number({ invalid_type_error: 'Head count must be a number' })
  .int('Head count must be a whole number')
  .min(1, 'Must have at least 1 animal')
  .max(100000, 'Head count must not exceed 100,000');

/**
 * Per head, in the market currency. Server parity: positive. (The wizard additionally asks for
 * at least 100; it is not used in pricing.)
 */
export const estimatedValueField = z.number({ invalid_type_error: 'Estimated value must be a number' })
  .positive('Estimated value per head must be greater than 0');

export const NULL_ISLAND_MESSAGE = 'coordinates 0,0 are not a real location';

/** The server's `notNullIsland`: (0,0) is a missing location, not a farm in the Gulf of Guinea. */
export function isNullIsland(latitude: unknown, longitude: unknown): boolean {
  return latitude === 0 && longitude === 0;
}
