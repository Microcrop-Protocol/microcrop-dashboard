/**
 * RECORD WHAT YOUR ORGANIZATION PAID THE FARMER, off-platform and off its own balance sheet.
 *
 * This form writes an ATTESTATION, not a payment. Nothing here moves money, creates a Payout or
 * changes a policy — MicroCrop stores the statement and labels it partner-attested and
 * unverified. The copy says that before the operator types anything, because a form that looks
 * like a payment form is how someone believes submitting it pays a farmer.
 *
 * WHY THE FIELDS ARE SHAPED THIS WAY
 * ----------------------------------
 * `partnerReference` IS THE IDEMPOTENCY KEY, together with the determination id. It must be the
 * partner's OWN settlement reference — the M-Pesa code, the bank reference, the receipt number —
 * and never a value this dialog generates. A per-attempt uuid would post the same money twice as
 * two separate attestations, which is exactly what the key exists to prevent; so the field is
 * operator-entered, explained, and the replay is surfaced honestly ("we already had this")
 * rather than reported as a fresh success.
 *
 * THE AMOUNT IS CONVERTED WITH THE SERVER'S OWN EXPONENT and sent as an exact integer string of
 * minor units. The scale is never assumed to be 2: if the determination could not state an
 * amount (no registered exponent for the policy's currency) the form refuses rather than guess,
 * because a guessed scale would be off by a factor of 100 in a financial record.
 *
 * OUTCOME DRIVES THE REST. The server requires a shortfall reason for a partial settlement and a
 * decline reason plus a zero amount for a decline, and refuses an amount above what it
 * determined. Those rules are mirrored here so the operator sees them at the field instead of as
 * a 400 after submitting — the server remains the enforcement.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  PARTNER_METHOD_LABELS,
  PARTNER_METHODS,
  PARTNER_OUTCOME_LABELS,
  PARTNER_OUTCOMES,
} from '@/lib/determinations';
import {
  compareMinor,
  formatMoneyMinor,
  InvalidAmountError,
  toMinorUnits,
  UnknownScaleError,
} from '@/lib/money-minor';
import { Loader2 } from 'lucide-react';
import type {
  PartnerDetermination,
  PartnerSettlementMethod,
  PartnerSettlementOutcome,
  PartnerSettlementReport,
  SettlementReportInput,
} from '@/types';

interface FormState {
  partnerReference: string;
  outcome: PartnerSettlementOutcome;
  method: PartnerSettlementMethod;
  amount: string;
  settledAt: string;
  attestingOfficerName: string;
  attestingOfficerTitle: string;
  attestingOfficerEmail: string;
  shortfallReason: string;
  declineReason: string;
  evidenceRef: string;
  notes: string;
}

function emptyForm(): FormState {
  return {
    partnerReference: '',
    outcome: 'SETTLED_FULL',
    method: 'MOBILE_MONEY',
    amount: '',
    settledAt: '',
    attestingOfficerName: '',
    attestingOfficerTitle: '',
    attestingOfficerEmail: '',
    shortfallReason: '',
    declineReason: '',
    evidenceRef: '',
    notes: '',
  };
}

export function SettlementReportDialog({
  determination,
  open,
  onOpenChange,
  /** Set when correcting: the live report this new attestation replaces. */
  supersedes,
}: {
  determination: PartnerDetermination;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supersedes?: PartnerSettlementReport | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const owed = determination.settlement.amountOwed;
  const currency = owed?.currency ?? determination.policy?.currency ?? null;
  const exponent = owed?.exponent ?? null;

  // Reset on every open so a previous attempt's reference — the idempotency key — can never be
  // resubmitted by accident from a stale field.
  useEffect(() => {
    if (open) {
      setForm({
        ...emptyForm(),
        // Prefill the amount with what we determined is owed. It is the figure the partner is
        // reconciling against, and typing it back by hand is how a digit gets dropped.
        amount: owed?.amount ?? '',
      });
      setError(null);
    }
  }, [open, owed?.amount]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const declined = form.outcome === 'DECLINED';
  const partial = form.outcome === 'SETTLED_PARTIAL';

  /**
   * The exact minor-unit string that will go on the wire, or the reason it cannot be produced.
   * Computed on every keystroke so the operator sees "that is more than was determined" beside
   * the field rather than as a 400 half a minute later.
   */
  const converted = useMemo(() => {
    if (exponent === null) {
      return {
        minor: null,
        problem:
          'MicroCrop could not establish a minor-unit scale for this policy’s currency, so an ' +
          'exact amount cannot be recorded. Contact MicroCrop before reporting this settlement.',
      };
    }
    // A decline is fixed at zero by the server's own CHECK constraint; do not make the operator
    // type it, and do not let a stale amount field contradict the outcome.
    if (declined) return { minor: '0', problem: null as string | null };
    if (!form.amount.trim()) return { minor: null, problem: null as string | null };
    try {
      const minor = toMinorUnits(form.amount, exponent);
      if (owed && compareMinor(minor, owed.amountMinor) > 0) {
        return {
          minor,
          problem:
            `That is more than MicroCrop determined is owed (${formatMoneyMinor(
              owed.amountMinor,
              owed.currency,
              owed.exponent,
            )}). MicroCrop refuses a report above the determined amount.`,
        };
      }
      if (owed && compareMinor(minor, owed.amountMinor) < 0 && form.outcome === 'SETTLED_FULL') {
        return {
          minor,
          problem:
            'That is less than the determined amount, so this is a partial settlement. Choose ' +
            '“Settled in part” and give a shortfall reason.',
        };
      }
      return { minor, problem: null as string | null };
    } catch (err) {
      if (err instanceof UnknownScaleError || err instanceof InvalidAmountError) {
        return { minor: null, problem: err.message };
      }
      throw err;
    }
  }, [declined, exponent, form.amount, form.outcome, owed]);

  const mutation = useMutation({
    mutationFn: (body: SettlementReportInput) =>
      api.recordSettlementReport(determination.id, body),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['determination', determination.id] });
      queryClient.invalidateQueries({ queryKey: ['determinations'] });
      onOpenChange(false);
      if (result.replayed) {
        // Told plainly. A replay is a correct, safe outcome — but reporting it as "recorded"
        // would let an operator believe a second, separate settlement had been logged.
        notifySuccess(
          'Already recorded',
          `MicroCrop already had a settlement report under reference ${result.report.partnerReference}. ` +
            'Nothing was recorded twice.',
        );
      } else {
        notifySuccess(
          'Settlement report recorded',
          'Stored as your organization’s own attestation. MicroCrop has not verified it and moved no money.',
        );
      }
    },
    onError: (err) => notifyError(err, "Couldn't record the settlement report."),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!converted.minor || converted.problem) {
      setError(converted.problem ?? 'Enter the amount you settled.');
      return;
    }
    if (!currency) {
      setError('This policy has no currency on record, so a settlement cannot be reported.');
      return;
    }

    const body: SettlementReportInput = {
      partnerReference: form.partnerReference.trim(),
      outcome: form.outcome,
      method: form.method,
      settledAmountMinor: converted.minor,
      settlementCurrency: currency,
      // A date input yields YYYY-MM-DD; the server takes an ISO date.
      settledAt: new Date(form.settledAt).toISOString(),
      attestingOfficerName: form.attestingOfficerName.trim(),
      attestingOfficerTitle: form.attestingOfficerTitle.trim(),
      ...(form.attestingOfficerEmail.trim()
        ? { attestingOfficerEmail: form.attestingOfficerEmail.trim() }
        : {}),
      // Sent ONLY on the outcome that requires it: the server forbids the other field outright
      // rather than ignoring it, so an always-included empty string is a 400.
      ...(partial ? { shortfallReason: form.shortfallReason.trim() } : {}),
      ...(declined ? { declineReason: form.declineReason.trim() } : {}),
      ...(form.evidenceRef.trim() ? { evidenceRef: form.evidenceRef.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      ...(supersedes ? { supersedesReportId: supersedes.id } : {}),
    };

    mutation.mutate(body);
  }

  const missingRequired =
    !form.partnerReference.trim() ||
    !form.settledAt ||
    !form.attestingOfficerName.trim() ||
    !form.attestingOfficerTitle.trim() ||
    (partial && !form.shortfallReason.trim()) ||
    (declined && !form.declineReason.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {supersedes ? 'Correct your settlement report' : 'Record your settlement'}
          </DialogTitle>
          <DialogDescription>
            {supersedes
              ? 'A settlement report is never edited. This records a NEW attestation that ' +
                'replaces the previous one; the old report stays visible in the audit trail.'
              : 'Tell MicroCrop what your organization paid this farmer off-platform. This ' +
                'records your own attestation — MicroCrop moves no money here, creates no ' +
                'payout, and does not verify what you report.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          {owed && (
            <p className="rounded-md bg-muted/50 p-3 text-sm">
              MicroCrop determined this policy owes{' '}
              <span className="font-semibold">
                {formatMoneyMinor(owed.amountMinor, owed.currency, owed.exponent)}
              </span>
              .
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="partnerReference">Your settlement reference</Label>
            <Input
              id="partnerReference"
              value={form.partnerReference}
              onChange={(e) => set('partnerReference', e.target.value)}
              placeholder="e.g. QK73HG9XYZ"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              The reference from your own payment — the M-Pesa code, bank reference or receipt
              number. Reporting the same reference again returns the record you already gave us
              instead of recording the payment twice, so use the real one.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="outcome">Outcome</Label>
              <Select
                value={form.outcome}
                onValueChange={(v) => set('outcome', v as PartnerSettlementOutcome)}
              >
                <SelectTrigger id="outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTNER_OUTCOMES.map((outcome) => (
                    <SelectItem key={outcome} value={outcome}>
                      {PARTNER_OUTCOME_LABELS[outcome]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">How it was paid</Label>
              <Select
                value={form.method}
                onValueChange={(v) => set('method', v as PartnerSettlementMethod)}
              >
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTNER_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {PARTNER_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount settled{currency ? ` (${currency})` : ''}</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={declined ? '0' : form.amount}
                disabled={declined}
                onChange={(e) => set('amount', e.target.value)}
                placeholder="16500.00"
              />
              {declined && (
                <p className="text-xs text-muted-foreground">
                  A declined settlement is recorded as zero.
                </p>
              )}
              {converted.problem && !declined && (
                <p className="text-xs text-error">{converted.problem}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="settledAt">Date settled</Label>
              <Input
                id="settledAt"
                type="date"
                value={form.settledAt}
                onChange={(e) => set('settledAt', e.target.value)}
              />
            </div>
          </div>

          {partial && (
            <div className="space-y-2">
              <Label htmlFor="shortfallReason">Why less than the determined amount?</Label>
              <Textarea
                id="shortfallReason"
                value={form.shortfallReason}
                onChange={(e) => set('shortfallReason', e.target.value)}
                rows={2}
              />
            </div>
          )}

          {declined && (
            <div className="space-y-2">
              <Label htmlFor="declineReason">Why was the farmer not paid?</Label>
              <Textarea
                id="declineReason"
                value={form.declineReason}
                onChange={(e) => set('declineReason', e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                A refusal to pay a farmer is the statement that most needs a named signatory —
                which is why the officer fields below are required for a decline too.
              </p>
            </div>
          )}

          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Who is attesting</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="officerName">Name</Label>
                <Input
                  id="officerName"
                  value={form.attestingOfficerName}
                  onChange={(e) => set('attestingOfficerName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="officerTitle">Title</Label>
                <Input
                  id="officerTitle"
                  value={form.attestingOfficerTitle}
                  onChange={(e) => set('attestingOfficerTitle', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="officerEmail">Email (optional)</Label>
              <Input
                id="officerEmail"
                type="email"
                value={form.attestingOfficerEmail}
                onChange={(e) => set('attestingOfficerEmail', e.target.value)}
              />
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="evidenceRef">Your evidence reference (optional)</Label>
            <Input
              id="evidenceRef"
              value={form.evidenceRef}
              onChange={(e) => set('evidenceRef', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A pointer to your own receipt, so it is nameable from MicroCrop's record. MicroCrop
              does not fetch or verify it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || missingRequired || Boolean(converted.problem)}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {supersedes ? 'Record correction' : 'Record settlement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
