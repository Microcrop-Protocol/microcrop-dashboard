/**
 * THE AUTH FOOTER MUST NOT INVENT A TERMS PAGE.
 *
 * "© MicroCrop · Privacy · Terms" has one real destination and one that does not exist yet.
 * The marketing site serves /privacy; it does not serve /terms, and no terms copy has been
 * signed off. The temptation is to point Terms at /terms anyway because the pattern looks
 * symmetrical — that ships a 404 from the sign-in page of an insurance product, which reads
 * to a partner as a missing legal document rather than a missing page.
 *
 * What is pinned here: Privacy always resolves to an absolute marketing URL; Terms is null
 * unless explicitly configured, and never degrades to a guessed path.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { privacyUrl, termsUrl, hasTerms, marketingOrigin } from '../legal';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('privacyUrl', () => {
  it('points at the marketing privacy page by default', () => {
    expect(privacyUrl()).toBe('https://microcrop.app/privacy');
  });

  it('follows an overridden marketing origin, without doubling the slash', () => {
    vi.stubEnv('VITE_MARKETING_URL', 'https://staging.microcrop.app/');
    expect(privacyUrl()).toBe('https://staging.microcrop.app/privacy');
  });

  it('ignores a marketing origin that is not an absolute http(s) URL', () => {
    // A bare host or relative path would resolve against the dashboard and open a broken
    // in-app route instead of the marketing site.
    for (const bad of ['microcrop.app', '/marketing', 'javascript:alert(1)', '', '   ']) {
      vi.stubEnv('VITE_MARKETING_URL', bad);
      expect(privacyUrl()).toBe('https://microcrop.app/privacy');
    }
  });

  it('always returns an absolute https URL', () => {
    expect(marketingOrigin()).toMatch(/^https:\/\//);
  });
});

describe('termsUrl fails closed', () => {
  it('is null when unset — there is no published terms page', () => {
    expect(termsUrl()).toBeNull();
    expect(hasTerms()).toBe(false);
  });

  it('does not guess a /terms path off the marketing origin', () => {
    vi.stubEnv('VITE_MARKETING_URL', 'https://microcrop.app');
    expect(termsUrl()).toBeNull();
  });

  it('is null for blank or malformed configuration', () => {
    for (const bad of ['', '   ', 'microcrop.app/terms', '/terms', 'ftp://microcrop.app/terms']) {
      vi.stubEnv('VITE_TERMS_URL', bad);
      expect(termsUrl()).toBeNull();
    }
  });

  it('becomes a link once a real terms URL is configured', () => {
    vi.stubEnv('VITE_TERMS_URL', 'https://microcrop.app/terms/');
    expect(termsUrl()).toBe('https://microcrop.app/terms');
    expect(hasTerms()).toBe(true);
  });
});
