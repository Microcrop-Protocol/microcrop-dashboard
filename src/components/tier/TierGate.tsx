/**
 * TIER-AWARE SURFACES — "not on your plan", never "broken".
 *
 * A settlement feature that a Determination-tier partner cannot use must read as a PLAN
 * BOUNDARY with a route forward. The three failure modes this file exists to prevent:
 *
 *   a dead button      a control that looks live, is clicked, and returns a 403. The partner
 *                      cannot tell a plan boundary from an outage, so it files a bug.
 *   a raw 403          the server's refusal text rendered as a red error toast. Correct, and
 *                      unreadable — it names a `settlementMode` and an enum value.
 *   a flash            rendering "not on your plan" for a beat while the org loads, on a
 *                      partner who IS on the settlement plan. That reads as a downgrade.
 *
 * So: while the tier is loading nothing decides; on a known Tier 1 the surface explains what the
 * plan DOES do first and points at Determinations; and when the tier cannot be read at all the
 * copy says exactly that and offers a retry, rather than asserting a plan boundary we have not
 * confirmed.
 */
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  TIER1_LOCKED_BODY,
  TIER1_LOCKED_NEXT,
  TIER1_LOCKED_TITLE,
  TIER1_UPGRADE_BODY,
  TIER_UNKNOWN_BODY,
  TIER_UNKNOWN_TITLE,
  type TierState,
} from '@/lib/tier';
import { FileSignature, Lock, RefreshCw, ShieldQuestion } from 'lucide-react';

/**
 * The panel that replaces a settlement screen for a Determination-tier organization.
 *
 * Note the order: what your plan DOES, then where the thing you bought lives, then the upgrade.
 * Leading with the refusal is what makes a plan boundary feel like an outage.
 */
export function SettlementNotOnPlanCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" aria-hidden="true" />
          {TIER1_LOCKED_TITLE}
        </CardTitle>
        <CardDescription>{TIER1_LOCKED_BODY}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="flex items-start gap-2 text-muted-foreground">
          <FileSignature className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {TIER1_LOCKED_NEXT}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/org/determinations">View determinations</Link>
          </Button>
        </div>
        <div className="rounded-lg border border-dashed p-3 text-muted-foreground">
          {TIER1_UPGRADE_BODY}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Shown when the org's plan could not be read. NOT the same thing as being on Tier 1, and it
 * must not borrow that copy: we would be telling a partner it does not have something we simply
 * failed to look up.
 */
export function TierUnknownCard({
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
          {TIER_UNKNOWN_TITLE}
        </CardTitle>
        <CardDescription>{TIER_UNKNOWN_BODY}</CardDescription>
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

/** The placeholder that holds the layout while the tier resolves. Decides nothing. */
export function TierLoadingCard({ className }: { className?: string }) {
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
 * Render `children` only on a positively-known settlement tier; otherwise render the state's own
 * panel. One component so no caller can accidentally implement the four-way branch with three
 * arms and leave `loading` falling through to the locked panel.
 */
export function SettlementTierGate({
  state,
  onRetry,
  children,
  className,
}: {
  state: TierState;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (state === 'loading') return <TierLoadingCard className={className} />;
  if (state === 'determination') return <SettlementNotOnPlanCard className={className} />;
  if (state === 'unknown') return <TierUnknownCard className={className} onRetry={onRetry} />;
  return <>{children}</>;
}

/**
 * A short inline banner for a page that still has content to show (a list that is legitimately
 * empty under Tier 1, for instance) and only needs to explain WHY it is empty.
 *
 * `role="note"` matches the SimulatedBanner convention, so the two read the same way to a screen
 * reader and to a test.
 */
export function SettlementNotOnPlanNote({
  children,
  className,
}: {
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
        <p className="font-medium">{TIER1_LOCKED_TITLE}</p>
        <p className="mt-1 text-muted-foreground">{children ?? TIER1_LOCKED_BODY}</p>
        <Link
          to="/org/determinations"
          className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
        >
          Go to Determinations
        </Link>
      </div>
    </div>
  );
}
