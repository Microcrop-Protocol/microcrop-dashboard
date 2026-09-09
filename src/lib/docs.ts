/**
 * PARTNER DOCUMENTATION — the outbound link, and why it can be absent.
 *
 * The docs are a separate Mintlify site, not a route in this app, so this is an external
 * link rather than a react-router destination.
 *
 * IT IS DELIBERATELY OPTIONAL. `docsUrl()` returns null when VITE_DOCS_URL is unset, and
 * every caller must hide its control in that case rather than rendering a disabled or
 * placeholder link. At the time of writing the docs site is NOT deployed — docs.microcrop.app
 * does not resolve — and a nav item pointing at a dead host is worse than no nav item: the
 * partner cannot tell our outage from their network, and it costs a support ticket. This repo
 * has just spent a release cycle removing documentation that sent partners to endpoints
 * returning 404; shipping a 404 link from the product itself would be the same defect wearing
 * a different hat.
 *
 * To switch it on, set VITE_DOCS_URL to the deployed docs origin (no trailing slash) and
 * redeploy. Nothing else needs to change.
 */

/** The configured docs origin, or null when the site is not deployed / not configured. */
export function docsUrl(): string | null {
  const raw = import.meta.env.VITE_DOCS_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  // Only ever emit an absolute http(s) origin. A misconfigured value such as a bare host or a
  // relative path would otherwise resolve against the dashboard and open a broken in-app URL.
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/** True when there is a real docs site to link to. */
export function hasDocs(): boolean {
  return docsUrl() !== null;
}

/**
 * A deep link to one page, e.g. docsPage('guides/verification').
 *
 * Returns null when docs are not configured, so a caller cannot accidentally build a link
 * against an empty origin. Leading slashes on `path` are tolerated.
 */
export function docsPage(path?: string): string | null {
  const base = docsUrl();
  if (!base) return null;
  if (!path) return base;
  return `${base}/${String(path).replace(/^\/+/, '')}`;
}

/**
 * Named pages worth linking to from the product. Keep these in step with
 * microcrop-docs/docs.json — a path that is not in that navigation is not reachable, which is
 * exactly how three of these pages shipped orphaned and unrenderable.
 */
export const DOCS_PAGES = {
  serviceTiers: 'guides/service-tiers',
  tier1Integration: 'guides/tier-1-integration',
  verification: 'guides/verification',
  determinations: 'guides/determinations',
  webhooks: 'guides/webhooks',
  authentication: 'authentication',
  apiReference: 'api-reference/overview',
} as const;
