import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resetChunkReloadForTests, isChunkLoadError, navigateAway, reloadOnceForStaleChunk } from '../chunk-reload';
import { importWithRetry } from '../lazy-retry';

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: /assets/Page-abc.js');

/** 'pending' if the promise has neither resolved nor rejected after a tick. */
async function settled(p: Promise<unknown>): Promise<'resolved' | 'rejected' | 'pending'> {
  return Promise.race([
    p.then(() => 'resolved' as const, () => 'rejected' as const),
    new Promise<'pending'>((r) => setTimeout(() => r('pending'), 20)),
  ]);
}

describe('route imports while the app navigates away', () => {
  const reload = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    __resetChunkReloadForTests();
    sessionStorage.clear();
    reload.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true, writable: true, value: { ...originalLocation, href: '/org/dashboard', reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: originalLocation });
  });

  it('an import aborted by the sign-out navigation neither reloads nor throws', async () => {
    // A recent reload means that, without the flag, this failure would be thrown to the boundary.
    sessionStorage.setItem('chunk_reload_at', String(Date.now()));
    navigateAway('/login');

    const result = await settled(importWithRetry(() => Promise.reject(chunkError())));

    expect(result).toBe('pending');
    expect(reload).not.toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('a stale chunk with no navigation pending reloads once and hangs', async () => {
    const result = await settled(importWithRetry(() => Promise.reject(chunkError())));
    expect(result).toBe('pending');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a chunk still missing right after a reload is thrown, not reloaded again', async () => {
    sessionStorage.setItem('chunk_reload_at', String(Date.now()));
    const result = await settled(importWithRetry(() => Promise.reject(chunkError())));
    expect(result).toBe('rejected');
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloadOnceForStaleChunk does not reload while a navigation is pending', () => {
    navigateAway('/login');
    expect(reloadOnceForStaleChunk()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/a.js',
    'Importing a module script failed.',
    'error loading dynamically imported module: https://x/assets/a.js',
    'Unable to preload CSS for /assets/a.css',
  ])('matches %s', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it('matches a ChunkLoadError by name', () => {
    expect(isChunkLoadError(Object.assign(new Error('Loading chunk 3 failed.'), { name: 'ChunkLoadError' }))).toBe(true);
  });

  it('does not match an ordinary render error', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
