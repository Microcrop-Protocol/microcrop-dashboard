/**
 * FACT 1 — WHAT MICROCROP DETERMINED.
 *
 * This is the artifact a Determination-tier partner actually bought, so it is the first card on
 * the page and it is identical in both tiers. It states the measured loss, the methodology it
 * was measured under, the canonical hash, the signer and the notary anchor — the things a third
 * party needs to re-derive the result without asking MicroCrop for anything.
 *
 * `verifiable: false` is surfaced rather than hidden: a legacy EVM-only record still exports,
 * but cannot be independently re-verified, and a partner relying on the package for an audit
 * has to know which kind it is holding.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TriggeredBadge } from './FactBadges';
import { EvidencePackageActions } from './EvidencePackageActions';
import { determinationKindLabel } from '@/lib/determinations';
import { formatBasisPoints } from '@/lib/money-minor';
import { formatDate } from '@/lib/utils';
import { BadgeCheck, ScrollText, ShieldCheck } from 'lucide-react';
import type { DeterminedFact } from '@/types';

/** A `dt`/`dd` pair. Long hashes wrap and break rather than forcing the page to scroll. */
function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-xs' : 'text-sm'}>{children ?? '—'}</dd>
    </div>
  );
}

export function DeterminedFactCard({
  determinationId,
  determined,
}: {
  determinationId: string;
  determined: DeterminedFact;
}) {
  const notary = determined.notary;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" aria-hidden="true" />
              What MicroCrop determined
            </CardTitle>
            <CardDescription>
              The signed, independently verifiable result. This is what MicroCrop asserts, and it
              is the same under either service plan.
            </CardDescription>
          </div>
          <TriggeredBadge triggered={determined.triggered} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Kind">{determinationKindLabel(determined.kind)}</Field>
          <Field label="Measured loss">{formatBasisPoints(determined.damagePercentBp)}</Field>
          <Field label="Policy trigger">
            {determined.thresholdBp === null
              ? '—'
              : formatBasisPoints(determined.thresholdBp)}
          </Field>
          <Field label="Methodology">{determined.methodologyVersion}</Field>
          <Field label="Assessed">{formatDate(determined.assessedAt, 'MMM d, yyyy')}</Field>
          <Field label="Determined">
            {formatDate(determined.determinedAt, 'MMM d, yyyy HH:mm')}
          </Field>
          {determined.unitCode && <Field label="Insurance unit">{determined.unitCode}</Field>}
        </dl>

        <div className="space-y-4 rounded-lg border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Proof
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Canonical hash" mono>
              {determined.canonicalHash ?? '—'}
            </Field>
            <Field label="Signer" mono>
              {determined.signerAddress ?? '—'}
            </Field>
            {notary && (
              <>
                <Field label={`Notary${notary.provider ? ` (${notary.provider})` : ''}`} mono>
                  {notary.reference ?? notary.txHash ?? '—'}
                </Field>
                <Field label="Anchored">
                  {notary.anchoredAt ? formatDate(notary.anchoredAt, 'MMM d, yyyy HH:mm') : '—'}
                </Field>
              </>
            )}
          </dl>

          {/* Stated in both directions. A partner presenting this to a regulator has to know
              whether the package it is holding can be re-verified without MicroCrop. */}
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {determined.evidence.verifiable
              ? 'The evidence package carries the canonical signed determination: anyone can ' +
                're-derive the hash and recover the signer without MicroCrop.'
              : 'This determination predates the chain-neutral canonical format. The evidence ' +
                'package still downloads, but it cannot be independently re-verified from its ' +
                'contents alone.'}
          </p>

          <EvidencePackageActions
            determinationId={determinationId}
            available={determined.evidence.available}
          />
        </div>
      </CardContent>
    </Card>
  );
}
