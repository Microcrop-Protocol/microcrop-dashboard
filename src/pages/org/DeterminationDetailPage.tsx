/**
 * ONE DETERMINATION — THE THREE FACTS, STACKED AND NEVER MERGED.
 *
 *   1. What MicroCrop determined      signed, hashed, anchored, downloadable, re-verifiable.
 *   2. Whether MicroCrop settled      under the Determination plan, a deliberate NO, stated in
 *                                     the server's own words and with the amount owed in the
 *                                     policy's own currency.
 *   3. What the partner reported      partner-attested, unverified, with its correction chain.
 *
 * The page is three cards in that order and there is no combined status anywhere on it. Anyone
 * adding a fourth "overall" badge to the header should read the FACT 2 and FACT 3 card comments
 * first: a single status is the failure this layout exists to prevent.
 *
 * WHO MAY REPORT. The write needs `settlement:report`, which the backend grants to ORG_FINANCE
 * and ORG_ADMIN only — every other org role can read the determination but not attest on the
 * organization's behalf. A role without it sees the card and its history, and is told why the
 * button is not there rather than being shown one that 403s.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeterminedFactCard } from '@/components/determinations/DeterminedFactCard';
import { SettlementFactCard } from '@/components/determinations/SettlementFactCard';
import { PartnerReportFactCard } from '@/components/determinations/PartnerReportFactCard';
import { SettlementReportDialog } from '@/components/determinations/SettlementReportDialog';
import { tierLabel } from '@/lib/tier';
import { ArrowLeft, Loader2, PenLine } from 'lucide-react';
import type { PartnerSettlementReport } from '@/types';

/** The write capability, spelled exactly as the backend grants it. */
const SETTLEMENT_REPORT_PERMISSION = 'settlement:report';

export default function DeterminationDetailPage() {
  const { determinationId } = useParams();
  const perms = usePermissions();
  const [reporting, setReporting] = useState(false);
  const [correcting, setCorrecting] = useState<PartnerSettlementReport | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['determination', determinationId],
    queryFn: () => api.getDetermination(determinationId!),
    enabled: !!determinationId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    // A cross-org id and an unknown id are indistinguishable by design (the server returns the
    // same 404 for both, so a guess cannot confirm another tenant's record exists), so the copy
    // must not claim which one happened.
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/org/determinations">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to determinations
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">We couldn't open this determination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              It may not exist, or it may not belong to your organization. If you followed a link
              from your own list, try again.
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              <Loader2 className="mr-2 h-4 w-4" /> Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { policy, determined, settlement, partnerReport } = data;

  // The per-policy FROZEN mode decides whether reporting applies to THIS cover — never the org's
  // current tier. A partner that upgrades to settlement must still be able to report (and
  // correct) settlements on the Tier 1 policies it already sold.
  const partnerSettles = !settlement.settledByMicrocrop;
  const canReport = perms.has(SETTLEMENT_REPORT_PERMISSION);
  const current = partnerReport.report;

  const reportAction = !partnerSettles ? null : !canReport ? (
    <p className="text-sm text-muted-foreground">
      Recording a settlement is a financial attestation on your organization's behalf, so only a
      finance officer or an administrator can do it. Ask one of them to record this settlement.
    </p>
  ) : (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setReporting(true)}>
        <PenLine className="mr-2 h-4 w-4" />
        {current ? 'Record another settlement' : 'Record your settlement'}
      </Button>
      {current && (
        <Button size="sm" variant="outline" onClick={() => setCorrecting(current)}>
          Correct this report
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/org/determinations" aria-label="Back to determinations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {policy?.policyNumber ?? 'Determination'}
          </h1>
          <p className="text-muted-foreground">
            {policy ? (
              <>
                <Link
                  to={`/org/policies/${policy.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  View policy
                </Link>
                {policy.coverageType ? ` · ${policy.coverageType}` : ''}
              </>
            ) : (
              'This determination is not linked to one of your policies.'
            )}
          </p>
        </div>
        {/* The PLAN THIS COVER WAS SOLD UNDER, not the org's current plan. Labelled as such so a
            partner that has since upgraded is not confused by an older policy reading
            "Determination". */}
        {policy?.settlementMode && (
          <StatusBadge
            variant="default"
            title="The service plan this cover was sold under. It is frozen at inception and never changes, so a later plan change cannot alter who owes this farmer."
          >
            Sold under: {tierLabel(policy.settlementMode)}
          </StatusBadge>
        )}
      </div>

      {/* FACT 1 */}
      <DeterminedFactCard determinationId={data.id} determined={determined} />

      {/* FACT 2 */}
      <SettlementFactCard settlement={settlement} />

      {/* FACT 3 */}
      <PartnerReportFactCard fact={partnerReport} action={reportAction} />

      <SettlementReportDialog
        determination={data}
        open={reporting}
        onOpenChange={setReporting}
      />
      <SettlementReportDialog
        determination={data}
        open={Boolean(correcting)}
        onOpenChange={(open) => !open && setCorrecting(null)}
        supersedes={correcting}
      />
    </div>
  );
}
