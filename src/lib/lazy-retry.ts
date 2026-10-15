import { lazy, type ComponentType } from "react";
import { isNavigationPending, reloadOnceForStaleChunk } from "@/lib/chunk-reload";

type RouteModule = { default: ComponentType };

/** A promise that never settles: the import "hangs" until the page is replaced. */
const untilPageIsReplaced = () => new Promise<RouteModule>(() => {});

/**
 * Import a route chunk, recovering from a failed import instead of surfacing it:
 * - the app is navigating away (sign-out → /login) and the browser aborted this import on the
 *   way out: neither a stale build nor an error, so hang until the page is replaced;
 * - otherwise, not reloaded recently: reload to pick up the new build, and hang meanwhile;
 * - otherwise (already reloaded for this moments ago and it did not help): throw, and the
 *   error boundary shows the error instead of reloading in a loop.
 */
export function importWithRetry(importFn: () => Promise<RouteModule>): Promise<RouteModule> {
  return importFn().catch((error) => {
    if (isNavigationPending()) return untilPageIsReplaced();
    if (reloadOnceForStaleChunk()) return untilPageIsReplaced();
    throw error;
  });
}

// Recover from stale route chunks after a deploy (see lib/chunk-reload).
export function lazyRetry(importFn: () => Promise<RouteModule>) {
  return lazy(() => importWithRetry(importFn));
}
