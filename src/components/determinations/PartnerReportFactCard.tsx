/**
 * FACT 3 — WHAT THE PARTNER SAYS IT DID.
 *
 * Never merged into FACT 2, never styled as a MicroCrop confirmation, and never shown without
 * the unverified label. The API's own `note` is rendered verbatim because it is the sentence we
 * are prepared to stand behind ("MicroCrop did NOT settle this policy, did not observe the
 * payment and has NOT verified this report") and a UI paraphrase would be softer than the
 * record.
 *
 * A report is never edited. A correction is a NEW attestation naming the one it supersedes, so
 * the whole chain is shown — superseded rows included, visibly struck through rather than
 * hidden. Hiding them would defeat the append-only design that makes this an audit trail.
 *
 * THE AWAITING AND OVERDUE STATES ARE FIRST-CLASS. `OVERDUE` is a REPORTING state: the window
 * closed with no report from the partner. It does NOT mean MicroCrop owes anything, and the copy
 * says so, because "overdue" next to a money figure is otherwise read as a debt.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { PartnerReportBadge, UnverifiedLabel } from './FactBadges';
import { PARTNER_METHOD_LABELS, PARTNER_OUTCOME_LABELS } from '@/lib/determinations';
import { formatMoneyMinor } from '@/lib/money-minor';
import { formatDate } from '@/lib/utils';
import { CalendarClock, ClipboardList } from 'lucide-react';
import type { PartnerReportFact, PartnerSettlementReport } from '@/types';

function outcomeLabel(report: PartnerSettlementReport): string {
  return PARTNER_OUTCOME_LABELS[report.outcome] ?? report.outcome;
}

function methodLabel(report: PartnerSettlementReport): string {
  return PARTNER_METHOD_LABELS[report.method] ?? report.method;
}

/**
 * One attestation. `exponent` is not carried on a stored report, so the human string the server
 * already formatted (`settledAmount`) is preferred and the minor-unit string is only used as the
 * fallback — never a guessed scale of 2.
 */
function ReportRow({ report }: { report: PartnerSettlementReport }) {
  const superseded = Boolean(report.supersededAt);
  const amount = report.settledAmount
    ? `${report.settlementCurrency} ${report.settledAmount}`
    : formatMoneyMinor(report.settledAmountMinor, report.settlementCurrency, null);

  return (
    <div className={superseded ? 'space-y-2 py-3 opacity-60' : 'space-y-2 py-3'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={superseded ? 'font-semibold line-through' : 'font-semibold'}>
            {amount}
          </span>
          <StatusBadge variant={report.outcome === 'DECLINED' ? 'default' : 'info'}>
            {outcomeLabel(report)}
          </StatusBadge>
          {superseded && (
            <StatusBadge
              variant="expired"
              title="Superseded by a later correction. Kept because a settlement report is never edited — the chain is the audit trail."
            >
              Superseded
            </StatusBadge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(report.reportedAt, 'MMM d, yyyy HH:mm')}
        </span>
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="break-all font-mono text-xs">{report.partnerReference}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Method</dt>
          <dd>{methodLabel(report)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Settled</dt>
          <dd>{formatDate(report.settledAt, 'MMM d, yyyy')}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Attested by</dt>
          <dd>
            {report.attestingOfficer.name}
            {report.attestingOfficer.title ? `, ${report.attestingOfficer.title}` : ''}
          </dd>
        </div>
      </dl>

      {report.shortfallReason && (
        <p className="text-sm">
          <span className="text-muted-foreground">Shortfall reason: </span>
          {report.shortfallReason}
        </p>
      )}
      {report.declineReason && (
        <p className="text-sm">
          <span className="text-muted-foreground">Decline reason: </span>
          {report.declineReason}
        </p>
      )}
      {report.notes && (
        <p className="text-sm">
          <span className="text-muted-foreground">Notes: </span>
          {report.notes}
        </p>
      )}
      {report.evidenceRef && (
        <p className="break-all text-xs text-muted-foreground">
          Your evidence reference: <span className="font-mono">{report.evidenceRef}</span> —
          MicroCrop stores this so your own receipt is nameable from our record; it does not
          fetch, resolve or vouch for it.
        </p>
      )}
    </div>
  );
}

export function PartnerReportFactCard({
  fact,
  action,
}: {
  fact: PartnerReportFact;
  /** The "Record settlement" control, injected so this card stays a pure renderer. */
  action?: React.ReactNode;
}) {
  // Tier 2: MicroCrop settled it itself, so there is no partner attestation to make. Shown as a
  // short statement rather than hidden, so the three facts are always three on every screen.
  if (fact.status === 'NOT_APPLICABLE') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Partner settlement report
          </CardTitle>
          <CardDescription>{fact.note}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              What you reported
              <UnverifiedLabel className="text-xs font-normal text-muted-foreground" />
            </CardTitle>
            <CardDescription>{fact.note}</CardDescription>
          </div>
          <PartnerReportBadge status={fact.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* The reporting window, stated whenever one exists — including after a late report, so
            the lateness is not erased by the report arriving. */}
        {fact.dueAt && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {fact.status === 'OVERDUE' ? (
              <span>
                A settlement report was due by {formatDate(fact.dueAt)} and MicroCrop has not
                received one. This is a reporting state only — it does not mean MicroCrop owes
                anything on this policy.
              </span>
            ) : (
              <span>Settlement report due by {formatDate(fact.dueAt)}.</span>
            )}
          </p>
        )}

        {!fact.reportRequired && fact.status !== 'REPORTED' && (
          <p className="text-sm text-muted-foreground">
            Nothing is owed on this determination, so no settlement report is expected.
          </p>
        )}

        {fact.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No settlement report has been recorded yet.
          </p>
        ) : (
          <div className="divide-y">
            {fact.history.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </div>
        )}

        {action}
      </CardContent>
    </Card>
  );
}
