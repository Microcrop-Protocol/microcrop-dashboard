import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { navigateAway } from "@/lib/chunk-reload";

/**
 * Shown instead of the login page when the session is still valid but the token refresh after
 * a reload could not reach the server (rate limit, network, 5xx). The store keeps retrying on
 * a backoff and this disappears as soon as a retry succeeds; "Try again" just retries now.
 */
export function SessionReconnecting({ message }: { message: string }) {
  const refreshAccessToken = useAuthStore((s) => s.refreshAccessToken);
  const logout = useAuthStore((s) => s.logout);
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await refreshAccessToken();
    } finally {
      setRetrying(false);
    }
  };

  const signOut = () => {
    logout();
    navigateAway("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center space-y-4" role="alert">
        <h2 className="text-xl font-semibold">Reconnecting to MicroCrop</h2>
        <p className="text-muted-foreground">
          You are still signed in, but we couldn't reach the server to resume your session. We'll
          keep trying automatically.
        </p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => void retry()} disabled={retrying}>
            {retrying ? "Trying..." : "Try again"}
          </Button>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
