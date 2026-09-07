/**
 * Farmer consent — capture, status and withdrawal (Kenya Data Protection Act 2019).
 *
 * WHY THIS EXISTS: the backend has had a complete consent API for a while
 * (`GET /farmers/consent/documents`, `GET|POST /farmers/:id/consent`,
 * `POST /farmers/:id/consent/withdraw`) and nothing in the dashboard called any of it,
 * so in a real user test consent could never actually be captured or withdrawn. This is
 * the UI half of that record.
 *
 * ############################################################################
 * # THIS COMPONENT AUTHORS NO CONSENT WORDING AND MUST NEVER BE MADE TO.     #
 * # The only text a farmer may be shown is `ConsentDocument.body` exactly as #
 * # the API returns it. Every document in the registry today is a            #
 * # placeholder — `body: null`, `approved: false`, version                   #
 * # `0.0.0-UNAPPROVED-PLACEHOLDER` — so this screen shows the backend's own  #
 * # warning and states plainly that no approved wording exists. A screen     #
 * # that LOOKS like it is presenting terms, filled with invented text, is    #
 * # the failure this file is written to prevent: someone will screenshot it. #
 * ############################################################################
 *
 * Permissions mirror the routes: reads need `farmer:read` (every role that can already
 * see a farmer), capture and withdrawal need `farmer:update` — which the field agent
 * holds, because the agent in front of the farmer IS the point of capture. Withdrawal
 * is a right, not an admin action, so it sits behind the same permission as capture.
 * Server-side gates are the real enforcement; this only hides controls that would 403.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileWarning, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { api } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/error-messages';
import { notifySuccess, notifyError } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  CONSENT_METHOD_OPTIONS,
  canWithdraw,
  consentMethodLabel,
  consentStatusPresentation,
  formatConsentTimestamp,
} from '@/lib/consent';
import type {
  ConsentDocument,
  ConsentMethod,
  FarmerConsentDocumentStatus,
} from '@/types';

interface RecordInput {
  documentId: string;
  method: ConsentMethod;
  evidenceRef?: string;
  locale?: string;
}

interface DocumentRowProps {
  doc: FarmerConsentDocumentStatus;
  /** The registry entry, which is the ONLY carrier of the document text. */
  registryDoc: ConsentDocument | undefined;
  canCapture: boolean;
  isBusy: boolean;
  onRecord: (input: RecordInput) => void;
  onWithdraw: (input: { documentId: string; reason?: string }) => void;
}

function ConsentDocumentRow({
  doc,
  registryDoc,
  canCapture,
  isBusy,
  onRecord,
  onWithdraw,
}: DocumentRowProps) {
  const [method, setMethod] = useState<ConsentMethod | ''>('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [locale, setLocale] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState('');

  const presentation = consentStatusPresentation(doc.status);
  const record = doc.consent;
  const grantedAt = formatConsentTimestamp(record?.grantedAt);
  const revokedAt = formatConsentTimestamp(record?.revokedAt);

  // Consent recorded against wording that does not exist is consent to nothing — the
  // backend refuses to count it, and the operator has to be able to see why.
  const grantedButUnusable = doc.status === 'GRANTED' && !doc.documentApproved;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-words">{doc.documentId}</p>
          <p className="text-sm text-muted-foreground">{doc.purpose}</p>
        </div>
        <div className="flex items-center gap-2">
          {doc.required && (
            <StatusBadge variant="info">Required</StatusBadge>
          )}
          <StatusBadge variant={presentation.variant}>{presentation.label}</StatusBadge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{presentation.explanation}</p>

      {grantedButUnusable && (
        <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
          Recorded, but against unapproved placeholder wording — the backend does not
          count it as valid consent.
        </p>
      )}

      {/* THE DOCUMENT ITSELF. Rendered from the API or not at all.
          The test id is load-bearing: a test asserts the exact text of this block so
          that invented consent copy cannot be slipped in here unnoticed. */}
      <div
        data-testid={`consent-document-text-${doc.documentId}`}
        className="rounded-md bg-muted/50 p-3 space-y-2 text-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Document text (as returned by the API)
        </p>
        {registryDoc?.body ? (
          <>
            <p className="whitespace-pre-wrap">{registryDoc.body}</p>
            {registryDoc.bodySha256 && (
              <p className="text-xs text-muted-foreground break-all">
                Text hash: {registryDoc.bodySha256}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            The API returns no text for this document (<code>body</code> is null). There
            is nothing to present to the farmer and nothing for them to agree to.
          </p>
        )}
        <p className="text-xs text-muted-foreground break-all">
          Version in force: {doc.requiredVersion}
        </p>
      </div>

      {/* The backend's own warning and TODO, verbatim. Never restated or paraphrased. */}
      {!doc.documentApproved && (doc.warning || doc.todo) && (
        <div className="rounded-md border border-destructive/50 p-3 space-y-2 text-sm text-destructive">
          {doc.warning && <p>{doc.warning}</p>}
          {doc.todo && <p className="text-xs">{doc.todo}</p>}
        </div>
      )}

      {record && (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="inline text-muted-foreground">Method: </dt>
            <dd className="inline">{consentMethodLabel(record.method)}</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Given: </dt>
            <dd className="inline">{grantedAt ?? '—'}</dd>
          </div>
          <div className="break-all">
            <dt className="inline text-muted-foreground">Version consented to: </dt>
            <dd className="inline">{record.documentVersion}</dd>
          </div>
          {record.evidenceRef && (
            <div className="break-all">
              <dt className="inline text-muted-foreground">Evidence: </dt>
              <dd className="inline">{record.evidenceRef}</dd>
            </div>
          )}
          {record.locale && (
            <div>
              <dt className="inline text-muted-foreground">Language presented: </dt>
              <dd className="inline">{record.locale}</dd>
            </div>
          )}
          {revokedAt && (
            <div>
              <dt className="inline text-muted-foreground">Withdrawn: </dt>
              <dd className="inline">{revokedAt}</dd>
            </div>
          )}
          {record.revokedReason && (
            <div className="break-words">
              <dt className="inline text-muted-foreground">Withdrawal reason: </dt>
              <dd className="inline">{record.revokedReason}</dd>
            </div>
          )}
        </dl>
      )}

      {!canCapture ? (
        <p className="text-sm text-muted-foreground">
          You do not have permission to record or withdraw consent for this farmer.
        </p>
      ) : withdrawing ? (
        <div className="space-y-2">
          <Label htmlFor={`withdraw-reason-${doc.documentId}`}>
            Reason for withdrawal (optional)
          </Label>
          <Input
            id={`withdraw-reason-${doc.documentId}`}
            placeholder="Recorded with the withdrawal"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={isBusy}
              onClick={() =>
                onWithdraw({ documentId: doc.documentId, reason: reason.trim() || undefined })
              }
            >
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Confirm withdrawal
            </Button>
            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() => { setWithdrawing(false); setReason(''); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              How was this consent captured?
            </legend>
            {CONSENT_METHOD_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`${doc.documentId}-${option.value}`}
                  name={`consent-method-${doc.documentId}`}
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                  className="h-4 w-4"
                />
                <Label
                  htmlFor={`${doc.documentId}-${option.value}`}
                  className="font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`evidence-${doc.documentId}`}>
                Evidence reference (optional)
              </Label>
              <Input
                id={`evidence-${doc.documentId}`}
                placeholder="Signature file key, SMS message id, paper form number"
                value={evidenceRef}
                onChange={(e) => setEvidenceRef(e.target.value)}
              />
            </div>
            {/* A language is only meaningful once there is wording to present in it.
                While `body` is null nothing is shown to the farmer in any language, so
                the field would invite a false record. */}
            {doc.documentApproved && (
              <div className="space-y-1">
                <Label htmlFor={`locale-${doc.documentId}`}>
                  Language presented (optional)
                </Label>
                <Input
                  id={`locale-${doc.documentId}`}
                  placeholder="en, sw"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                />
              </div>
            )}
          </div>

          {!doc.documentApproved && (
            <p className="text-sm text-muted-foreground">
              This document has no approved wording, so recording against it only
              exercises the mechanism — it is not usable consent, and the backend
              refuses the request outright in production.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isBusy || !method}
              onClick={() =>
                method &&
                onRecord({
                  documentId: doc.documentId,
                  method,
                  evidenceRef: evidenceRef.trim() || undefined,
                  locale: locale.trim() || undefined,
                })
              }
            >
              {isBusy
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />}
              {doc.status === 'REVOKED' ? 'Record consent again' : 'Record consent'}
            </Button>
            {canWithdraw(doc.status) && (
              <Button
                variant="outline"
                disabled={isBusy}
                onClick={() => { setWithdrawing(true); setReason(''); }}
              >
                <ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
                Withdraw consent
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface FarmerConsentPanelProps {
  farmerId: string;
}

/**
 * Card-less body so it can be dropped into the onboarding wizard's own step card as
 * well as the farmer detail page's card without nesting chrome.
 */
export function FarmerConsentPanel({ farmerId }: FarmerConsentPanelProps) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canCapture = can.editFarmers;

  const documentsQuery = useQuery({
    queryKey: ['consent-documents'],
    queryFn: () => api.getConsentDocuments(),
  });

  const statusQuery = useQuery({
    queryKey: ['farmer-consent', farmerId],
    queryFn: () => api.getFarmerConsent(farmerId),
    enabled: Boolean(farmerId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['farmer-consent', farmerId] });
  };

  const recordMutation = useMutation({
    mutationFn: (input: RecordInput) => api.recordFarmerConsent(farmerId, input),
    onSuccess: (result, input) => {
      invalidate();
      notifySuccess(
        result.replayed ? 'Consent already on record' : 'Consent recorded',
        result.replayed
          ? `${input.documentId} was already granted at the current version; nothing was duplicated.`
          : `${input.documentId} recorded as ${consentMethodLabel(input.method)}.`,
      );
    },
    onError: (error) => notifyError(error, "Couldn't record the farmer's consent."),
  });

  const withdrawMutation = useMutation({
    mutationFn: (input: { documentId: string; reason?: string }) =>
      api.withdrawFarmerConsent(farmerId, input),
    onSuccess: (result, input) => {
      invalidate();
      notifySuccess(
        result.alreadyRevoked ? 'Consent already withdrawn' : 'Consent withdrawn',
        `${input.documentId} is recorded as withdrawn. The record of the original consent is kept.`,
      );
    },
    onError: (error) => notifyError(error, "Couldn't withdraw the farmer's consent."),
  });

  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading consent status" />
      </div>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <p className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
        {getErrorMessage(statusQuery.error, "Couldn't load this farmer's consent status.")}
      </p>
    );
  }

  const status = statusQuery.data;
  const registry = documentsQuery.data;
  const registryById = new Map(
    (registry?.documents ?? []).map((doc) => [doc.documentId, doc]),
  );
  const isBusy = recordMutation.isPending || withdrawMutation.isPending;

  return (
    <div className="space-y-4">
      {/* No approved wording exists. Say it first, say it loudly, and use the
          backend's own warning string rather than inventing a summary of it. */}
      {registry && !registry.approvedCopyAvailable && (
        <div className="rounded-md border border-destructive/50 p-4 space-y-2">
          <div className="flex items-start gap-2 text-destructive">
            <FileWarning className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="font-medium">
              No approved consent wording exists yet — nothing here can be presented to a farmer
            </p>
          </div>
          {registry.warning && (
            <p className="text-sm text-destructive">{registry.warning}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Legal/DPO-reviewed copy has to land in the backend registry before any real
            farmer is asked to consent, including in a pilot.
          </p>
        </div>
      )}

      {/* Never let `hasValidConsent` be read as "something is being enforced". */}
      <div className="rounded-md border p-3 space-y-1">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">
            {status.enforcedOnPurchase
              ? 'Consent is enforced on policy purchase.'
              : 'Consent is not enforced on policy purchase.'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {status.enforcedOnPurchase
            ? 'A policy cannot be sold to this farmer unless every required consent is granted at the current version.'
            : 'The API reports enforcedOnPurchase = false. A policy can still be sold to this farmer whether or not any consent is recorded here — this screen records the fact, it does not gate anything.'}
        </p>
      </div>

      {status.documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The API returned no consent documents.
        </p>
      ) : (
        status.documents.map((doc) => (
          <ConsentDocumentRow
            key={doc.documentId}
            doc={doc}
            registryDoc={registryById.get(doc.documentId)}
            canCapture={canCapture}
            isBusy={isBusy}
            onRecord={(input) => recordMutation.mutate(input)}
            onWithdraw={(input) => withdrawMutation.mutate(input)}
          />
        ))
      )}
    </div>
  );
}

/** The farmer detail page's framing of the same panel. */
export function FarmerConsentCard({ farmerId }: FarmerConsentPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data Protection Consent</CardTitle>
      </CardHeader>
      <CardContent>
        <FarmerConsentPanel farmerId={farmerId} />
      </CardContent>
    </Card>
  );
}
