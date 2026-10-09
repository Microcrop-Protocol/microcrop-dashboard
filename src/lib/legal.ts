/**
 * LEGAL LINKS IN THE AUTH FOOTER — and why Terms is not a link.
 *
 * The auth pages carry a small footer: "© MicroCrop · Privacy · Terms". Privacy and Terms
 * are pages on the MARKETING site (a separate Next.js app), not routes in this dashboard,
 * so they are external links rather than react-router destinations.
 *
 * They are NOT equivalent today:
 *
 *   Privacy — exists. The marketing site serves /privacy and it resolves. Always linked.
 *   Terms   — DOES NOT EXIST. There is no terms page on the marketing site and no terms
 *             copy that counsel has signed off on. `termsUrl()` therefore returns null by
 *             default, and the footer must render "Terms" as plain muted text rather than
 *             an anchor. Pointing a user at a 404 from the sign-in page of an insurance
 *             product is worse than showing them nothing: it reads as a missing legal
 *             document, which is exactly what it is.
 *
 * This follows the same rule as lib/docs.ts: a link we cannot honour is not shipped as a
 * link. When counsel delivers terms and the marketing site publishes the page, set
 * VITE_TERMS_URL to its absolute URL and the footer turns it into a link with no code
 * change. Nothing here authors legal copy — these are destinations only.
 */

const DEFAULT_MARKETING_ORIGIN = 'https://microcrop.app';

/** Only ever emit an absolute http(s) URL — a bare host or relative path would resolve
 *  against the dashboard and open a broken in-app URL. */
function absoluteUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/** The marketing site origin (no trailing slash). Overridable for preview environments. */
export function marketingOrigin(): string {
  return absoluteUrl(import.meta.env.VITE_MARKETING_URL) ?? DEFAULT_MARKETING_ORIGIN;
}

/** The privacy policy URL. Always present — the marketing site serves this page. */
export function privacyUrl(): string {
  return `${marketingOrigin()}/privacy`;
}

/**
 * The terms of service URL, or null when there is no published terms page.
 *
 * Null is the default and the expected answer today. Callers MUST render plain text when
 * this is null; they must not fall back to a guessed `/terms` path.
 */
export function termsUrl(): string | null {
  return absoluteUrl(import.meta.env.VITE_TERMS_URL);
}

/** True when there is a real terms page to link to. */
export function hasTerms(): boolean {
  return termsUrl() !== null;
}
