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

/**
 * Hard-reload once to pick up a new build. Returns true if it triggered a reload,
 * false if it reloaded too recently (caller should then surface the error).
 */
export function reloadOnceForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last <= CHUNK_RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (private mode / disabled) — still attempt one reload.
  }
  window.location.reload();
  return true;
}
