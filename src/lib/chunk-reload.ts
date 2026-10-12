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

/**
 * Hard-reload once to pick up a new build. Returns true if a reload is under way (started
 * now or by an earlier caller on this page), false if the page was ALREADY reloaded for a
 * stale chunk within the window and that did not fix it (caller should then surface the
 * error rather than loop).
 */
export function reloadOnceForStaleChunk(): boolean {
  if (reloadPending) return true;
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
}
