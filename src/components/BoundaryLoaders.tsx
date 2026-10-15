import { useEffect } from "react";
import { isNavigationPending, navigateAway } from "@/lib/chunk-reload";

// Fallbacks ErrorBoundary renders instead of the error screen when an error is not the user's
// problem: a reload for a new build, or a page torn down by a sign-out.

export function BoundaryLoader({ label, scope }: { label: string; scope: "app" | "route" }) {
  return (
    <div
      className={`flex ${scope === "app" ? "min-h-screen" : "min-h-[50vh]"} flex-col items-center justify-center gap-3`}
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

// How long a signed-out page may sit on the loader before we take the user to sign-in
// ourselves. Normally the sign-out's own navigation gets there first.
const SIGNED_OUT_REDIRECT_MS = 1500;

/**
 * Shown when a protected page throws after the user was signed out. The sign-out normally
 * navigates to /login straight after (which resets a route boundary), so this is a brief
 * loader; if nothing navigates, it goes to /login itself rather than spin forever.
 */
export function SignedOutLoader({ scope }: { scope: "app" | "route" }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isNavigationPending()) navigateAway("/login");
    }, SIGNED_OUT_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, []);
  return <BoundaryLoader label="Signing you out…" scope={scope} />;
}
