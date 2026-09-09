/**
 * THE DOCS LINK MUST NOT EXIST UNTIL THE DOCS DO.
 *
 * The docs site is a separate Mintlify deployment and, at the time of writing, is not live —
 * docs.microcrop.app does not resolve. A sidebar item pointing at a dead host is worse than no
 * item: the partner cannot distinguish our outage from their own network, and it costs a
 * support ticket. This repo has just spent a release removing documentation that sent partners
 * to endpoints returning 404; a 404 link shipped from the product itself is the same defect.
 *
 * So the rule pinned here is: absent, blank or malformed configuration yields NULL, and callers
 * hide the control. It never degrades to a relative path, an empty origin or a placeholder.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { docsUrl, hasDocs, docsPage, DOCS_PAGES } from '../docs';

function setUrl(value: unknown) {
  vi.stubEnv('VITE_DOCS_URL', value as string);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('docsUrl fails closed', () => {
  it('is null when unset', () => {
    setUrl(undefined);
    expect(docsUrl()).toBeNull();
    expect(hasDocs()).toBe(false);
  });

  it('is null for an empty or whitespace value', () => {
    for (const v of ['', '   ', '\n']) {
      setUrl(v);
      expect(docsUrl()).toBeNull();
    }
  });

  it('is null for anything that is not an absolute http(s) origin', () => {
    // A bare host or a relative path would resolve against the dashboard and open a broken
    // in-app URL, which looks like a product bug rather than missing configuration.
    for (const v of ['docs.microcrop.app', '/docs', 'ftp://docs.microcrop.app', 'javascript:alert(1)']) {
      setUrl(v);
      expect(docsUrl()).toBeNull();
    }
  });

  it('accepts a real origin and strips trailing slashes', () => {
    setUrl('https://docs.microcrop.app/');
    expect(docsUrl()).toBe('https://docs.microcrop.app');
    expect(hasDocs()).toBe(true);

    setUrl('https://docs.microcrop.app///');
    expect(docsUrl()).toBe('https://docs.microcrop.app');
  });
});

describe('docsPage', () => {
  it('is null whenever docs are not configured, so no caller can build an empty-origin link', () => {
    setUrl('');
    expect(docsPage(DOCS_PAGES.verification)).toBeNull();
    expect(docsPage()).toBeNull();
  });

  it('joins without doubling or dropping the separator', () => {
    setUrl('https://docs.microcrop.app');
    expect(docsPage('guides/verification')).toBe('https://docs.microcrop.app/guides/verification');
    expect(docsPage('/guides/verification')).toBe('https://docs.microcrop.app/guides/verification');
    expect(docsPage()).toBe('https://docs.microcrop.app');
  });

  it('every named page is a plain relative path, never absolute', () => {
    // These are appended to an origin; a leading slash or a full URL here would silently
    // produce a wrong link.
    for (const path of Object.values(DOCS_PAGES)) {
      expect(path).not.toMatch(/^https?:\/\//);
      expect(path).not.toMatch(/^\//);
    }
  });
});
