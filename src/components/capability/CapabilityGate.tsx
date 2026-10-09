/**
 * CAPABILITY-AWARE SURFACES — "not on your plan", never "broken".
 *
 * The sibling of components/tier/TierGate.tsx, deliberately built to the same shape. The three
 * failure modes it exists to prevent are the same three:
 *
 *   a dead control   a button that looks live, is clicked, and returns 403
 *                    CAPABILITY_NOT_ENABLED. The partner cannot tell a plan boundary from an
 *                    outage, so it files a bug.
 *   a raw 403        the server's refusal rendered as a red error toast. Correct, and arriving
 *                    only after the click — which is the part that makes it feel like a fault.
 *   a flash          rendering "not on your plan" for a beat while the capability map loads, on
 *                    a partner that HAS the capability. That reads as a downgrade.
 *
 * So: while the map is loading nothing decides; on a known deny the surface says what is off and
 * who can turn it on; and when the map cannot be read at all the copy says exactly that and
 * offers a retry rather than asserting a plan boundary we have not confirmed.
 *
 * CAPABILITY IS NOT PERMISSION. This component answers "does the ORGANIZATION have this
 * feature". Whether THIS USER may use it is `ProtectedRoute` / `usePermissions`, and the two need
 * different copy — "ask your administrator" vs "contact MicroCrop". A surface that needs both
 * should keep the permission gate outermost: telling a Viewer that its organization's plan is the
 * problem would send it to the wrong place.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  CAPABILITY_LOCKED_NEXT,
  CAPABILITY_UNKNOWN_BODY,
  CAPABILITY_UNKNOWN_TITLE,
  capabilityLockedBody,
  capabilityLockedTitle,
  type CapabilityState,
} from '@/lib/capability';
import type { OrgCapability } from '@/types';
import { Lock, Mail, RefreshCw, ShieldQuestion } from 'lucide-react';

/**
 * The panel that replaces a surface the organization does not have.
 *
 * Order matters: what is off, then that it is a platform setting rather than a fault, then that
 * nothing existing is affected. Leading with the refusal is what makes a plan boundary feel like
 * an outage.
 */
export function CapabilityNotOnPlanCard({
  capability,
  className,
}: {
  capability: OrgCapability;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" aria-hidden="true" />
          {capabilityLockedTitle(capability)}
        </CardTitle>
        <CardDescription>{capabilityLockedBody(capability)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {CAPABILITY_LOCKED_NEXT}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Shown when the capability map could not be read. NOT the same thing as a known deny, and it
 * must not borrow that copy: we would be telling a partner it does not have something we simply
 * failed to look up.
 */
export function CapabilityUnknownCard({
  onRetry,
  className,
}: {
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
          {CAPABILITY_UNKNOWN_TITLE}
        </CardTitle>
        <CardDescription>{CAPABILITY_UNKNOWN_BODY}</CardDescription>
      </CardHeader>
      {onRetry && (
        <CardContent>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

/** The placeholder that holds the layout while the map resolves. Decides nothing. */
export function CapabilityLoadingCard({ className }: { className?: string }) {
  return (
    <Card className={className} aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-9 w-40" />
      </CardContent>
    </Card>
  );
}

/**
 * Render `children` only on a positively-known grant; otherwise render the state's own panel.
 *
 * One component so no caller can implement the four-way branch with three arms and leave
 * `loading` falling through to the locked panel — which is the flash, and is the single easiest
 * way to get this wrong.
 */
export function CapabilityGate({
  capability,
  state,
  onRetry,
  children,
  className,
}: {
  capability: OrgCapability;
  state: CapabilityState;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (state === 'loading') return <CapabilityLoadingCard className={className} />;
  if (state === 'unavailable') {
    return <CapabilityNotOnPlanCard capability={capability} className={className} />;
  }
  if (state === 'unknown') return <CapabilityUnknownCard className={className} onRetry={onRetry} />;
  return <>{children}</>;
}

/**
 * A short inline note for a page that still has content to show and only needs to explain why
 * one part of it is inert.
 *
 * `role="note"` matches the SettlementNotOnPlanNote and SimulatedBanner convention, so all three
 * read the same way to a screen reader and to a test.
 */
export function CapabilityNotOnPlanNote({
  capability,
  children,
  className,
}: {
  capability: OrgCapability;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4 text-sm',
        className,
      )}
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium">{capabilityLockedTitle(capability)}</p>
        <p className="mt-1 text-muted-foreground">
          {children ?? `${capabilityLockedBody(capability)} ${CAPABILITY_LOCKED_NEXT}`}
        </p>
      </div>
    </div>
  );
}

/**
 * The inline variant of the three-way branch, for a note rather than a card.
 *
 * Renders NOTHING while loading — a note is additional context next to content that is already
 * on screen, and a skeleton note would make the page jump for no information. The control it
 * accompanies is the thing that must be disabled during loading, which is what
 * `CapabilityInfo.allowed` (false while loading) handles.
 */
export function CapabilityNote({
  capability,
  state,
  onRetry,
  className,
}: {
  capability: OrgCapability;
  state: CapabilityState;
  onRetry?: () => void;
  className?: string;
}) {
  if (state === 'enabled' || state === 'loading') return null;
  if (state === 'unknown') {
    return (
      <div
        role="note"
        className={cn(
          'flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4 text-sm',
          className,
        )}
      >
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium">{CAPABILITY_UNKNOWN_TITLE}</p>
          <p className="mt-1 text-muted-foreground">{CAPABILITY_UNKNOWN_BODY}</p>
          {onRetry && (
            <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }
  return <CapabilityNotOnPlanNote capability={capability} className={className} />;
}
