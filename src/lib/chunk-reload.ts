// Recovery for stale chunks after a deploy.
//
// The dashboard is a code-split Vite SPA: each route chunk has a content-hashed
// filename that changes on every build. A tab opened before a deploy still holds
// the old index.html referencing old chunk names, so navigating to a lazy route
// tries to fetch a filename that no longer exists ("Failed to fetch dynamically
// imported module" / a Vite `vite:preloadError`). A hard reload fetches the fresh
// index.html + the new chunk URLs.
//
// We guard with a short TIME WINDOW rather than a one-shot flag so the recovery
// RE-ARMS for later deploys within the same tab, while still avoiding a reload
// loop if a reload doesn't resolve it (e.g. a genuinely missing asset / offline).

const CHUNK_RELOAD_KEY = 'chunk_reload_at';
const CHUNK_RELOAD_WINDOW_MS = 10_000;

// Set once THIS page has asked for a reload. A stale chunk is reported twice for one
// navigation: Vite fires `vite:preloadError` (main.tsx), and the same failed import then
// rejects into lazyRetry (App.tsx). Without this flag the second caller read the timestamp
// the first had just written, concluded "reloaded too recently", and threw — so the error
// boundary painted "Something went wrong" for the second or two before the reload already
// in flight replaced the page. A reload that is pending is not a failure; later callers in
// the same page lifetime just wait for it.
let reloadPending = false;

// Set just before the app replaces the page itself (logout / deactivated org → /login). The
// browser aborts in-flight route imports when it starts that navigation, and the aborted import
// rejects with the same "Failed to fetch dynamically imported module" a stale chunk does. That is
// not a stale build and not an error: the page is going away. While this is set, no chunk failure
// reloads the page (which would race the navigation) or reaches an error boundary.
let navigationPending = false;

/** True once the app has started a full-page navigation away from this page. */
export function isNavigationPending(): boolean {
  return navigationPending;
}

/** Leave the SPA for `url` with a full-page navigation, marking it pending first. */
export function navigateAway(url: string): void {
  navigationPending = true;
  window.location.href = url;
}

const CHUNK_ERROR_PATTERN =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i;

/**
 * Whether `error` is a failed code-split import rather than a bug in a component. The wording is
 * the browser's own: Chrome "Failed to fetch dynamically imported module", Safari "Importing a
 * module script failed", Firefox "error loading dynamically imported module", webpack-style
 * "ChunkLoadError", and Vite's "Unable to preload CSS" for a missing stylesheet chunk.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: unknown; message?: unknown };
  const text = `${typeof e.name === 'string' ? e.name : ''} ${
    typeof e.message === 'string' ? e.message : typeof error === 'string' ? error : ''
  }`;
  return CHUNK_ERROR_PATTERN.test(text);
}

/**
 * Hard-reload once to pick up a new build. Returns true if a reload is under way (started
 * now or by an earlier caller on this page), false if the page was ALREADY reloaded for a
 * stale chunk within the window and that did not fix it (caller should then surface the
 * error rather than loop). Also true, without reloading, while a full-page navigation is pending.
 */
export function reloadOnceForStaleChunk(): boolean {
  // A page that is already navigating away needs no reload; the import failed because of it.
  if (reloadPending || navigationPending) return true;
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last <= CHUNK_RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (private mode / disabled) — still attempt one reload.
  }
  reloadPending = true;
  window.location.reload();
  return true;
}

/** Test-only: forget a pending reload (a real page is replaced by the reload instead). */
export function __resetChunkReloadForTests(): void {
  reloadPending = false;
  navigationPending = false;
}
