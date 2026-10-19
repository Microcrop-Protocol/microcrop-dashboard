/**
 * PLAN & FEATURES — the partner's own, read-only view of what its organization may do.
 *
 * WHY A PARTNER-FACING LIST EXISTS AT ALL. Without it, every capability a partner does not have
 * is discovered one surface at a time, by arriving somewhere and reading "not on your plan". That
 * is correct per-surface and awful in aggregate: there is no answer to "what DO we have?" and no
 * single place to see what to ask MicroCrop for. This panel is that answer.
 *
 * READ-ONLY, DELIBERATELY. A capability is a platform-side setting with a mandatory recorded
 * reason; it is not self-serve, and an editable control here would be a dead one. The same is
 * true of the service tier, which is changed by MicroCrop because a change only applies to cover
 * sold after it.
 *
 * NO OPERATOR NOTES. The API this reads (`GET /organizations/me/capabilities`) carries only the
 * capability, its label and the effective answer — not the `reason` an admin wrote or who wrote
 * it. Those are operator notes about the partner, written for other operators, and the
 * backend's org-facing projection withholds them on purpose.
 *
 * THE LOADING STATE SHOWS NEITHER ANSWER. A row rendered as "off" while the map resolves would
 * tell a partner it has lost a feature it has. Skeletons until the map lands.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useServiceTier } from '@/hooks/useServiceTier';
import {
  CAPABILITIES,
  CAPABILITY_DESCRIPTIONS,
  CAPABILITY_LOCKED_NEXT,
  CAPABILITY_UNKNOWN_BODY,
  CAPABILITY_UNKNOWN_TITLE,
  capabilityLabel,
} from '@/lib/capability';
import { SERVICE_TIER_LABELS, TIER2_RETIRED_NOTE, tier1UpgradeBody, tierLabel } from '@/lib/tier';
import { isBaseSettlementEnabled } from '@/lib/explorer';
import { Check, Lock, RefreshCw, ShieldQuestion } from 'lucide-react';

export function OrgPlanPanel() {
  const { statuses, isLoading, isError, stateOf, refetch } = useCapabilities();
  const tier = useServiceTier();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Plan &amp; features</h2>
        <p className="text-sm text-muted-foreground">
          What your organization can do on MicroCrop. These are set by MicroCrop, not from here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Service plan</CardTitle>
          <CardDescription>
            {/*
              Three-valued, from lib/tier: a loading tier must not render as either answer, and
              an unreadable one must not be reported as Tier 1.
            */}
            {tier.state === 'loading'
              ? 'Reading your plan…'
              : tier.state === 'unknown'
                ? "We couldn't confirm your service plan. Nothing is wrong with your policies."
                : `Your organization is on the ${tierLabel(tier.tier)} plan.`}
          </CardDescription>
        </CardHeader>
        {tier.state === 'determination' && (
          <CardContent className="text-sm text-muted-foreground">
            {tier1UpgradeBody()}
          </CardContent>
        )}
        {tier.state === 'settlement' && (
          <CardContent className="text-sm text-muted-foreground">
            {isBaseSettlementEnabled() ? (
              <>
                MicroCrop determines whether the trigger fired and settles the payout to the farmer
                for you. {SERVICE_TIER_LABELS.DETERMINATION_AND_SETTLEMENT} applies to cover sold
                while the plan is in force.
              </>
            ) : (
              TIER2_RETIRED_NOTE
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features</CardTitle>
          <CardDescription>{CAPABILITY_LOCKED_NEXT}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              {CAPABILITIES.map((capability) => (
                <Skeleton key={capability} className="h-12 w-full" />
              ))}
            </div>
          ) : isError || !statuses ? (
            <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">{CAPABILITY_UNKNOWN_TITLE}</p>
                <p className="mt-1">{CAPABILITY_UNKNOWN_BODY}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={refetch}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y">
              {statuses.map((entry) => {
                const on = stateOf(entry.capability) === 'enabled';
                return (
                  <li key={entry.capability} className="flex items-start gap-3 py-3">
                    {on ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <Lock
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {entry.label || capabilityLabel(entry.capability)}
                        </span>
                        <Badge variant={on ? 'default' : 'outline'} className="text-xs font-normal">
                          {on ? 'Included' : 'Not on your plan'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {CAPABILITY_DESCRIPTIONS[entry.capability] ?? ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
