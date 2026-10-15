import React from "react";
import { BoundaryLoader as Loader, SignedOutLoader } from "@/components/BoundaryLoaders";
import { useAuthStore } from "@/stores/authStore";
import {
  isChunkLoadError,
  isNavigationPending,
  reloadOnceForStaleChunk,
} from "@/lib/chunk-reload";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * When this changes, a caught error is cleared and the children render again. Route-level
   * boundaries pass the pathname, so navigating away from a page that threw recovers without a
   * reload and without remounting what sits outside the boundary (the sidebar, the header).
   */
  resetKey?: unknown;
  /** "app" fills the screen (the last-resort boundary); "route" fills the page area. */
  scope?: "app" | "route";
}

interface ErrorBoundaryState {
  error: Error | null;
  /**
   * For a chunk-load error: true while a reload to pick up the new build is under way, false
   * when the page was already reloaded for one moments ago and it did not help (show the error
   * rather than reload again). null until componentDidCatch has decided.
   */
  staleChunkReloading: boolean | null;
}

// Paths that only render for a signed-in user. Anything that throws there once the user is
// gone is the page being torn down by a sign-out, not a bug worth an error screen.
const PROTECTED_PATH = /^\/(org|platform)(\/|$)/;

function isSignedOutTeardown(): boolean {
  if (typeof window === "undefined") return false;
  return !useAuthStore.getState().user && PROTECTED_PATH.test(window.location.pathname);
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, staleChunkReloading: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error, staleChunkReloading: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (isChunkLoadError(error)) {
      // A route chunk from an older build (or an import the browser aborted). Reload once to
      // pick up the current build. reloadOnceForStaleChunk refuses a second reload within its
      // window, so a chunk that is genuinely missing ends on the error screen, not in a loop.
      const reloading = reloadOnceForStaleChunk();
      this.setState({ staleChunkReloading: reloading });
      if (reloading) return;
    }
    console.error("[MicroCrop] Uncaught error:", error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && !Object.is(prevProps.resetKey, this.props.resetKey)) {
      this.setState({ error: null, staleChunkReloading: null });
    }
  }

  // A state reset would just render the same tree, which throws the same error again. A reload
  // starts the page over: fresh build, fresh session refresh, fresh data.
  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, staleChunkReloading } = this.state;
    if (!error) return this.props.children;

    const scope = this.props.scope ?? "app";

    // The page is being replaced (sign-out, deactivated org). Whatever threw on the way out is
    // not the user's problem.
    if (isNavigationPending()) return <Loader label="Loading…" scope={scope} />;

    const chunkError = isChunkLoadError(error);
    if (chunkError && staleChunkReloading !== false) {
      return <Loader label="Updating…" scope={scope} />;
    }

    if (!chunkError && isSignedOutTeardown()) return <SignedOutLoader scope={scope} />;

    return (
      <div
        className={`flex ${scope === "app" ? "min-h-screen" : "min-h-[50vh]"} flex-col items-center justify-center gap-4 p-8`}
      >
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-4">
            {chunkError
              ? "We couldn't load the latest version of the dashboard. Check your connection and try again."
              : "An unexpected error occurred. Please try again."}
          </p>
          {!chunkError && (
            <pre className="mb-4 rounded bg-muted p-4 text-left text-sm text-muted-foreground overflow-auto max-h-32">
              {error.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleReload}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              Go to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
