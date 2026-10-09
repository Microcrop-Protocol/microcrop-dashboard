/**
 * VERIFICATION (KYB) — the in-dashboard, post-signup surface, in Settings.
 *
 * WHERE IT LIVES AND WHY. KYB is already post-signup on the backend: `registerOrganization` sets
 * `kybStatus = NOT_STARTED` and `onboardingStep = KYB_VERIFICATION` and the organization stays
 * gated until a platform admin verifies it. This panel is the other half of that — the place a
 * partner actually does it, inside Settings, as an ongoing property of the organization rather
 * than a step in a signup funnel. A partner comes back here after a rejection, when a licence
 * expires, and when a reviewer asks for a better scan; none of those are signup events.
 *
 * THE ENTITY-IDENTITY FIELDS ARE HERE, NOT AT SIGNUP. The company registration number is
 * definitionally a KYB datum: it is the input to AML screening (Sumsub ships it as
 * `info.companyInfo.registrationNumber`) and it belongs next to the certificate that proves it.
 * It used to be a required signup field, which bought nothing — a single character passed — while
 * costing a hard, unique-constraint 409 on a typo with no self-service remedy. The backend now
 * accepts it at submit and REFUSES the submission while it is still null, so this form is the
 * only place it can be supplied and it is mandatory here.
 *
 * WHAT MUST BE UPLOADED COMES FROM THE SERVER, ALWAYS. Every document slot, its label and
 * whether it is required is read from `GET /organizations/me/kyb` → `checklist`, which the
 * backend builds from the organization's own `countryCode`. The dashboard keeps NO document
 * table of its own — a second answer would let a partner satisfy the list it was shown and still
 * be refused by the submit, which enforces the server's list.
 *
 * THE SCREENING VERDICT IS NOT SHOWN, AND THAT IS NOT AN OVERSIGHT.
 *
 * A RED Sumsub answer is not an org-visible status. The backend's `toOrgFacingVerification` is an
 * allow-list projection built so a sanctioned or PEP-flagged partner cannot read its own AML hit
 * — the answer, the reject labels (SANCTIONS, PEP), the internal override note — off its own
 * dashboard. The brief asks this panel to show "RED"; it shows the only part of a RED a screened
 * party may be told, which is whether it is FIXABLE:
 *
 *   RETRY (a blurry scan, the wrong certificate, an expired licence) → the backend forwards
 *          `documentsResubmissionRequired` plus the moderator's applicant-facing comment, and
 *          this panel surfaces both as an action-needed state with the resubmit form open. A
 *          partner who is never told that is stuck, because resubmitting is the only way out.
 *   FINAL  (sanctions, PEP, fraud) → nothing is forwarded, and the partner sees the ordinary
 *          "under review" or, once a reviewer decides, "action needed" with the reviewer's own
 *          note. Telling a sanctioned party which list it matched is the exact disclosure the
 *          projection exists to prevent.
 *
 * The previous version of this page read `verification.sumsubReviewStatus` and
 * `sumsubReviewAnswer` directly. The API stopped sending them, so that indicator had become dead
 * code that could never fire — removed rather than left to look like a feature.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KYBDocumentUpload } from '@/components/kyb/KYBDocumentUpload';
import { notifyError, notifySuccess } from '@/lib/notify';
import { orgTypeLabels } from '@/lib/validations/kyb';
import { uploadFieldForCode } from '@/lib/kyb-upload';
import { level1Label as level1LabelFor, marketOrNull } from '@/lib/market';
import {
  AlertTriangle,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { KybChecklistItem, OrgKyb } from '@/types';

interface UploadedDocument {
  file: File;
  type: string;
  preview?: string;
}

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: typeof ShieldCheck }
> = {
  NOT_STARTED: { label: 'Not started', variant: 'secondary', icon: ShieldAlert },
  IN_PROGRESS: { label: 'In progress', variant: 'secondary', icon: Clock },
  PENDING_REVIEW: { label: 'Under review', variant: 'secondary', icon: Clock },
  VERIFIED: { label: 'Verified', variant: 'default', icon: ShieldCheck },
  REJECTED: { label: 'Action needed', variant: 'destructive', icon: ShieldAlert },
};

export function OrgVerificationPanel() {
  const queryClient = useQueryClient();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [orgType, setOrgType] = useState('');
  const [division, setDivision] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<OrgKyb>({
    queryKey: ['my-kyb'],
    queryFn: () => api.getMyKyb(),
  });

  // The organization row is where registrationNumber / type / county already live; the KYB
  // response carries the verification and the checklist. Both are needed to prefill a resubmit,
  // and this query shares the ['my-organization'] cache with useServiceTier and useOrgMarket, so
  // it is not an extra request.
  const { data: organization } = useQuery({
    queryKey: ['my-organization'],
    queryFn: () => api.getMyOrganization(),
  });

  /**
   * Prefill once, from whatever is already on file, so a resubmit does not make the partner
   * retype five fields to fix one.
   *
   * Guarded by `prefilled` rather than keyed on the data: a refetch landing while the partner is
   * mid-edit must not overwrite what they have typed. The guard flips as soon as EITHER source
   * resolves, because waiting for both would leave the fields permanently empty for an
   * organization that has a row but no verification yet (the NOT_STARTED case).
   */
  useEffect(() => {
    if (prefilled) return;
    if (!data && !organization) return;

    const verification = data?.verification;
    if (verification?.regulatorLicenseNumber) {
      setLicenseNumber(verification.regulatorLicenseNumber);
    }
    if (verification?.licenseExpiresAt) {
      setLicenseExpiry(verification.licenseExpiresAt.slice(0, 10));
    }
    if (organization?.registrationNumber) setRegistrationNumber(organization.registrationNumber);
    // 'OTHER' is the server-side default for an organization that never stated a type, so
    // prefilling it would present a guess as the partner's own answer. Left blank instead, which
    // is also what makes the field's placeholder visible.
    if (organization?.type && organization.type !== 'OTHER') setOrgType(organization.type);
    if (organization?.county) setDivision(organization.county);
    setPrefilled(true);
  }, [data, organization, prefilled]);

  const submitMutation = useMutation({
    mutationFn: async (docs: UploadedDocument[]) => {
      const fd = new FormData();
      for (const doc of docs) {
        const field = uploadFieldForCode(doc.type);
        if (field) fd.append(field, doc.file);
      }
      // Entity identity. Sent on every submit, including a resubmit that changes only a
      // document: the backend treats an omitted registration number as "keep what is on file",
      // so re-sending the same value is idempotent and sending a corrected one is the fix path
      // for a typo caught in review.
      fd.append('registrationNumber', registrationNumber.trim());
      if (orgType) fd.append('type', orgType);
      if (division.trim()) fd.append('county', division.trim());
      if (data?.checklist?.regulatorLicenseRequired) {
        fd.append('regulatorLicenseNumber', licenseNumber.trim());
        if (licenseExpiry) fd.append('licenseExpiresAt', new Date(licenseExpiry).toISOString());
      }
      return api.submitMyKyb(fd);
    },
    onSuccess: () => {
      notifySuccess('Submitted for review', 'Your documents are now with MicroCrop.');
      setDocuments([]);
      queryClient.invalidateQueries({ queryKey: ['my-kyb'] });
      queryClient.invalidateQueries({ queryKey: ['my-organization'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (error) => notifyError(error, "Couldn't submit your documents. Please try again."),
  });

  const checklist = data?.checklist;

  /**
   * Market presentation values. The CHECKLIST is preferred over the dashboard's own registry
   * because it is built from the same markets.js entry the server enforces against — so when the
   * two could disagree (an older dashboard build against a newer backend) the server wins.
   * lib/market is the fallback for a response that predates those fields.
   */
  const market = marketOrNull(data?.countryCode ?? organization?.countryCode);
  const divisionLabel = checklist?.adminDivisionLabels?.level1 ?? level1LabelFor(market);

  const requiredItems: KybChecklistItem[] = useMemo(
    () => checklist?.requiredDocuments ?? [],
    [checklist],
  );
  const labels = useMemo(
    () => Object.fromEntries(requiredItems.map((item) => [item.documentType, item.label])),
    [requiredItems],
  );

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // A failed read must not render the form: the required-document set and whether a licence is
  // needed are BOTH server-supplied, so a form built with neither would let a partner submit a
  // package that is refused for a reason the page never mentioned.
  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            We couldn't load your verification status
          </CardTitle>
          <CardDescription>
            Nothing has changed and nothing has been submitted. Try again, and contact MicroCrop
            if it keeps happening.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = data.kybStatus ?? 'NOT_STARTED';
  const meta = STATUS_META[status] ?? STATUS_META.NOT_STARTED;
  const StatusIcon = meta.icon;
  const verification = data.verification;
  const submittedDocs = verification?.documents ?? [];

  const verified = status === 'VERIFIED';
  // THE STUCK CASE. A retryable screening rejection leaves the org at PENDING_REVIEW — the
  // reviewer has made no decision, so the status has not moved — while the only way forward is
  // for the partner to resubmit. Without this branch the page would say "under review, we'll
  // email you" to a partner whose submission can only be unblocked by its own action.
  const resubmissionRequired = verification?.documentsResubmissionRequired === true;
  const pending = status === 'PENDING_REVIEW' && !resubmissionRequired;
  const canSubmit = !verified && !pending;

  const licenseRequired = checklist?.regulatorLicenseRequired ?? false;
  const regulator = checklist?.regulator ?? market?.regulator ?? 'your insurance regulator';

  const uploadedNow = new Set(documents.map((doc) => doc.type));
  const missingDocs = requiredItems.filter(
    (item) => !item.satisfied && !uploadedNow.has(String(item.documentType)),
  );
  const licenseMissing = licenseRequired && (!licenseNumber.trim() || !licenseExpiry);
  const registrationMissing = !registrationNumber.trim();
  const blocked = missingDocs.length > 0 || licenseMissing || registrationMissing;

  // A licence that is on file but expires soon is the one thing a VERIFIED org still has to act
  // on: the backend's assertRegulatorLicenseValid refuses underwriting the moment it lapses, so
  // a partner that is told nothing discovers it by failing to sell a policy.
  const licenseExpiresAt = verification?.licenseExpiresAt
    ? new Date(verification.licenseExpiresAt)
    : null;
  const licenseDaysLeft = licenseExpiresAt
    ? Math.ceil((licenseExpiresAt.getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Verification (KYB)</h2>
          <p className="text-sm text-muted-foreground">
            {checklist?.countryCode
              ? `Requirements for ${market?.countryName ?? checklist.countryCode}. `
              : ''}
            Verifying your organization unlocks underwriting.
          </p>
        </div>
        <Badge variant={meta.variant} className="gap-1">
          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {resubmissionRequired ? 'Action needed' : meta.label}
        </Badge>
      </div>

      {verified && (
        <Card className="border-success/40">
          <CardContent className="flex items-start gap-3 py-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-success" aria-hidden="true" />
            <div className="text-sm">
              <p>Your organization is verified. You can underwrite cover.</p>
              {licenseDaysLeft !== null && licenseDaysLeft <= 60 && (
                <p className="mt-1 text-muted-foreground">
                  {licenseDaysLeft > 0
                    ? `Your ${regulator} licence on file expires in ${licenseDaysLeft} day${licenseDaysLeft === 1 ? '' : 's'}. Submit a current one before it lapses — underwriting stops when it does.`
                    : `Your ${regulator} licence on file has expired. Submit a current one to resume underwriting.`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {pending && (
        <Card>
          <CardContent className="flex items-start gap-3 py-4">
            <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div className="text-sm">
              <p>Your documents are under review. We'll email you once a decision is made.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reviews include automated compliance checks, so this can take a little time.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/*
        The retryable-screening branch. Deliberately separate from the REJECTED branch below:
        no reviewer has rejected anything, so saying "your submission was rejected" would be
        wrong. `resubmissionNote` is the moderator's own applicant-facing comment and is rendered
        verbatim — paraphrasing the one actionable sentence the provider wrote for the partner to
        read would lose the detail that makes it actionable.
      */}
      {resubmissionRequired && (
        <Card className="border-destructive">
          <CardContent className="flex items-start gap-3 py-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium">Your documents need to be resubmitted</p>
              <p className="text-muted-foreground">
                {verification?.resubmissionNote ??
                  'One or more of the documents you uploaded could not be accepted. Upload clear, current copies below and submit again.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'REJECTED' && (
        <Card className="border-destructive">
          <CardContent className="flex items-start gap-3 py-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium">Your submission needs changes</p>
              {/*
                The reviewer's note, when there is one. The backend allows a rejection with no
                note, and "Your submission needs changes." with nothing after it is a dead end —
                so the fallback names the one thing the partner can do.
              */}
              <p className="text-muted-foreground">
                {verification?.verifierNotes ??
                  'MicroCrop could not verify this submission. Check that every document is current, legible and matches your registration details, then submit again. Contact MicroCrop if you are not sure what to change.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {submittedDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">On file</CardTitle>
            <CardDescription>
              Uploading a document again replaces the copy on file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {submittedDocs.map((doc) => {
              const label =
                labels[doc.documentCode ?? doc.documentType] ??
                (doc.documentCode ?? doc.documentType).replace(/_/g, ' ');
              return (
                <div key={doc.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">— {doc.fileName}</span>
                    {doc.isVerified && (
                      <Badge variant="outline" className="gap-1 text-xs font-normal">
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Checked
                      </Badge>
                    )}
                  </div>
                  {/* Per-document rejection reason: actionable, unlike the AML verdict. */}
                  {doc.rejectionReason && (
                    <p className="ml-6 mt-0.5 text-xs text-destructive">{doc.rejectionReason}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {submittedDocs.length > 0 ? 'Resubmit for review' : 'Submit for review'}
            </CardTitle>
            <CardDescription>
              {requiredItems.length > 0
                ? `Required for ${market?.countryName ?? checklist?.countryCode ?? 'your market'}: ${requiredItems.map((item) => item.label).join(', ')}.`
                : 'Your organization has no document requirements configured. Contact MicroCrop.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <fieldset className="space-y-4 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Company details</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="kyb-registration-number">
                    Company registration number{' '}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Input
                    id="kyb-registration-number"
                    value={registrationNumber}
                    onChange={(event) => setRegistrationNumber(event.target.value)}
                    aria-describedby="kyb-registration-number-hint"
                    aria-invalid={registrationMissing ? true : undefined}
                  />
                  <p id="kyb-registration-number-hint" className="text-xs text-muted-foreground">
                    This is what your organization is screened on. It must match the
                    business-registration certificate you upload.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kyb-org-type" id="kyb-org-type-label">
                    Organization type
                  </Label>
                  <Select value={orgType} onValueChange={setOrgType}>
                    <SelectTrigger id="kyb-org-type" aria-labelledby="kyb-org-type-label kyb-org-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(orgTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                {/* The column is `county`; what it is CALLED comes from the market. */}
                <Label htmlFor="kyb-division">{divisionLabel}</Label>
                <Input
                  id="kyb-division"
                  value={division}
                  onChange={(event) => setDivision(event.target.value)}
                  placeholder={`Your registered ${divisionLabel.toLowerCase()}`}
                />
              </div>
            </fieldset>

            <KYBDocumentUpload
              documents={documents}
              onDocumentsChange={setDocuments}
              requiredTypes={requiredItems.map((item) => String(item.documentType))}
              satisfiedTypes={requiredItems
                .filter((item) => item.satisfied)
                .map((item) => String(item.documentType))}
              labels={labels}
            />

            {licenseRequired && (
              <fieldset className="space-y-3 rounded-lg border p-4">
                <legend className="px-1 text-sm font-medium">{regulator} operating licence</legend>
                <p className="text-xs text-muted-foreground">
                  Your insurance regulator licence number and its expiry date are required in
                  this market. Underwriting stops automatically when the licence lapses.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="license-number">Licence number</Label>
                    <Input
                      id="license-number"
                      placeholder={`${regulator} licence number`}
                      value={licenseNumber}
                      onChange={(event) => setLicenseNumber(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="license-expiry">Expiry date</Label>
                    <Input
                      id="license-expiry"
                      type="date"
                      value={licenseExpiry}
                      onChange={(event) => setLicenseExpiry(event.target.value)}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            <div className="space-y-2">
              <Button
                onClick={() => submitMutation.mutate(documents)}
                disabled={submitMutation.isPending || blocked}
              >
                {submitMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Submit for review
              </Button>
              {/*
                Say exactly what is outstanding. The button is disabled, and a disabled button
                with no explanation is the same dead control a capability gate exists to avoid.
                role="status" so a screen reader hears the list change as files are added.
              */}
              {blocked && (
                <p role="status" className="text-xs text-muted-foreground">
                  {registrationMissing && 'Enter your company registration number. '}
                  {missingDocs.length > 0 &&
                    `Still needed: ${missingDocs.map((item) => item.label).join(', ')}. `}
                  {licenseMissing &&
                    `Enter your ${regulator} licence number and its expiry date.`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
