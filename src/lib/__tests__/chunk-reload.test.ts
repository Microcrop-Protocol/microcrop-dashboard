import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reloadOnceForStaleChunk, __resetChunkReloadForTests } from '../chunk-reload';

/**
 * One stale chunk is reported twice for a single navigation: `vite:preloadError` (main.tsx)
 * and then the rejected import inside lazyRetry (App.tsx). The second report used to see the
 * timestamp the first had just written, return false, and make lazyRetry throw, so the error
 * boundary flashed "Something went wrong" until the in-flight reload replaced the page.
 */
describe('reloadOnceForStaleChunk', () => {
  const reload = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    __resetChunkReloadForTests();
    sessionStorage.clear();
    reload.mockClear();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('reloads on the first stale-chunk report', () => {
    expect(reloadOnceForStaleChunk()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('tells a second caller on the same page to wait, not to throw', () => {
    reloadOnceForStaleChunk(); // vite:preloadError
    expect(reloadOnceForStaleChunk()).toBe(true); // lazyRetry, same navigation
    expect(reload).toHaveBeenCalledTimes(1); // one reload, not two
  });

  it('still refuses to loop when the page was already reloaded and the chunk is still missing', () => {
    // A previous page lifetime reloaded moments ago; this is the fresh page after that reload.
    sessionStorage.setItem('chunk_reload_at', String(Date.now()));

    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
