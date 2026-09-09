/**
 * FACT 2 — DID MICROCROP SETTLE?
 *
 * For a Determination-tier policy the answer is a deliberate NO, and this card has to say that
 * without reading as an error or as an unpaid debt of MicroCrop's. Three things make that work:
 *
 *   - the server's own `reason` sentence is rendered VERBATIM. It is the authoritative statement
 *     of the arrangement ("MicroCrop determined ... and deliberately did NOT originate or settle
 *     any payment ... the obligation is the partner's"), and paraphrasing it in the UI is how
 *     the API and the screen end up telling a partner two different things.
 *   - the amount owed is stated in the POLICY's own currency, derived from its own sumInsured.
 *     There is no USDC figure anywhere on a Tier 1 response and none is invented here: a partner
 *     settling in KES off its own balance sheet must not inherit an FX dependency from us.
 *   - the heading names the obligation as the partner's, so "not settled" cannot be misread as
 *     "MicroCrop still owes this".
 *
 * `amountOwedDiscrepancy` is rendered loudly when present. It means the figure derived from the
 * policy disagrees with the figure inside the SIGNED determination in the evidence package —
 * the one case where a partner must NOT pay from this screen.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SettlementFactBadge } from './FactBadges';
import { formatMoneyMinor } from '@/lib/money-minor';
import { AlertTriangle, Banknote, ExternalLink } from 'lucide-react';
import { explorerTxUrl } from '@/lib/explorer';
import type { SettlementFact } from '@/types';

export function SettlementFactCard({ settlement }: { settlement: SettlementFact }) {
  const partnerOwes = !settlement.settledByMicrocrop;
  const owed = settlement.amountOwed;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4" aria-hidden="true" />
              {partnerOwes ? 'Settlement — your obligation' : 'Settlement by MicroCrop'}
            </CardTitle>
            <CardDescription>
              {partnerOwes
                ? 'Whether MicroCrop settled this farmer. Under your plan it deliberately did not.'
                : 'MicroCrop originates and settles this payout.'}
            </CardDescription>
          </div>
          <SettlementFactBadge status={settlement.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {partnerOwes ? 'Amount this policy owes the farmer' : 'Amount owed'}
          </p>
          {owed ? (
            <>
              <p className="mt-1 text-2xl font-bold">
                {formatMoneyMinor(owed.amountMinor, owed.currency, owed.exponent)}
              </p>
              {/* The server states its own derivation; render it rather than restating the
                  arithmetic here, so the screen cannot describe a formula the API changed. */}
              <p className="mt-1 text-xs text-muted-foreground">{owed.basis}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {settlement.amountOwedUnavailableReason ??
                'MicroCrop cannot state an exact amount for this policy’s currency.'}
            </p>
          )}
        </div>

        {settlement.amountOwedDiscrepancy && (
          // The one case where a partner must stop. The derived figure and the figure inside the
          // SIGNED determination disagree, and the product is that the two agree.
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-error/40 bg-error/10 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-error">Do not settle on this determination yet</p>
              <p className="text-muted-foreground">{settlement.amountOwedDiscrepancy.note}</p>
              <p className="font-mono text-xs">
                derived {settlement.amountOwedDiscrepancy.derivedAmountMinor} · signed{' '}
                {settlement.amountOwedDiscrepancy.signedAmountMinor} (
                {settlement.amountOwedDiscrepancy.currency}, minor units)
              </p>
            </div>
          </div>
        )}

        {/* VERBATIM. This sentence is the arrangement, written by the API. */}
        {settlement.reason && (
          <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            {settlement.reason}
          </p>
        )}

        {settlement.failureReason && (
          <p className="rounded-lg border border-error/40 bg-error/10 p-4 text-sm">
            <span className="font-medium">Failure reason:</span> {settlement.failureReason}
          </p>
        )}

        {/* Tier 2 only — the block is absent entirely on a Tier 1 response, not nulled, so this
            renders nothing at all for a Determination-tier policy. */}
        {settlement.onChain && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Settlement transaction
              </dt>
              <dd className="break-all font-mono text-xs">
                {settlement.onChain.submittedTxHash ? (
                  <a
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    href={explorerTxUrl(settlement.onChain.submittedTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {settlement.onChain.submittedTxHash}
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Block</dt>
              <dd className="font-mono text-xs">{settlement.onChain.blockNumber ?? '—'}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
