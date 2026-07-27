import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KYBDocumentUpload } from '@/components/kyb/KYBDocumentUpload';
import { notifySuccess, notifyError } from '@/lib/notify';
import { documentTypeLabels } from '@/lib/validations/kyb';
import { ShieldCheck, ShieldAlert, Clock, Loader2, FileText } from 'lucide-react';
import type { KYBDocumentType, KybChecklistItem } from '@/types';

interface UploadedDocument {
  file: File;
  type: KYBDocumentType;
  preview?: string;
}

// Dashboard KYB doc type -> backend multipart field name (mirrors the backend's
// KYB_UPLOAD_FIELD_MAP — keep the two in sync).
const FIELD_FOR: Partial<Record<KYBDocumentType, string>> = {
  BUSINESS_REGISTRATION: 'businessRegistrationCert',
  TAX_CERTIFICATE: 'taxPinCert',
  DIRECTOR_ID: 'directorId',
  PROOF_OF_ADDRESS: 'proofOfAddress',
  BANK_STATEMENT: 'bankStatement',
  IRA_LICENSE: 'iraLicenseCert',
  NIC_LICENSE: 'nicLicenseCert',
  CERTIFICATE_OF_INCORPORATION: 'certificateOfIncorporation',
  GHANA_TIN: 'ghanaTin',
  OTHER: 'otherDocument',
};

// Fallback for a backend that doesn't serve the per-market checklist yet.
const DEFAULT_REQUIRED: KYBDocumentType[] = ['BUSINESS_REGISTRATION', 'TAX_CERTIFICATE'];

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

export default function KYBPage() {
  const queryClient = useQueryClient();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [licensePrefilled, setLicensePrefilled] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['my-kyb'],
    queryFn: () => api.getMyKyb(),
  });

  // Prefill the license fields from what's already on file (resubmits).
  useEffect(() => {
    if (licensePrefilled || !data?.verification) return;
    if (data.verification.regulatorLicenseNumber) {
      setLicenseNumber(data.verification.regulatorLicenseNumber);
    }
    if (data.verification.licenseExpiresAt) {
      setLicenseExpiry(data.verification.licenseExpiresAt.slice(0, 10));
    }
    setLicensePrefilled(true);
  }, [data, licensePrefilled]);

  const submitMutation = useMutation({
    mutationFn: async (docs: UploadedDocument[]) => {
      const fd = new FormData();
      for (const d of docs) {
        const field = FIELD_FOR[d.type];
        if (field) fd.append(field, d.file);
      }
      if (data?.checklist?.regulatorLicenseRequired) {
        fd.append('regulatorLicenseNumber', licenseNumber.trim());
        if (licenseExpiry) fd.append('licenseExpiresAt', new Date(licenseExpiry).toISOString());
      }
      return api.submitMyKyb(fd);
    },
    onSuccess: () => {
      notifySuccess('KYB submitted', 'Your documents are now under review.');
      setDocuments([]);
      queryClient.invalidateQueries({ queryKey: ['my-kyb'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (e) => notifyError(e, "Couldn't submit your documents. Please try again."),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const status = data?.kybStatus ?? 'NOT_STARTED';
  const meta = STATUS_META[status] ?? STATUS_META.NOT_STARTED;
  const StatusIcon = meta.icon;
  const verified = status === 'VERIFIED';
  const pending = status === 'PENDING_REVIEW';
  const submittedDocs = data?.verification?.documents ?? [];
  const canSubmit = !verified && !pending;

  // Per-market requirements from the backend checklist; fall back to the legacy
  // Kenya pair if the checklist is absent.
  const submittedTypes = new Set(submittedDocs.map((d) => d.documentType));
  const requiredItems: KybChecklistItem[] =
    data?.checklist?.requiredDocuments ??
    DEFAULT_REQUIRED.map((t) => ({
      documentType: t,
      label: documentTypeLabels[t] ?? t,
      required: true,
      satisfied: submittedTypes.has(t),
    }));
  const labels = Object.fromEntries(requiredItems.map((i) => [i.documentType, i.label]));
  const satisfiedTypes = requiredItems.filter((i) => i.satisfied).map((i) => i.documentType);

  const licenseRequired = data?.checklist?.regulatorLicenseRequired ?? false;
  const regulator = data?.checklist?.regulator ?? 'regulator';

  const uploadedNow = new Set(documents.map((d) => d.type));
  const missingDocs = requiredItems.filter(
    (i) => !i.satisfied && !uploadedNow.has(i.documentType)
  );
  const licenseMissing = licenseRequired && (!licenseNumber.trim() || !licenseExpiry);
  const screeningInProgress =
    Boolean(data?.verification?.sumsubReviewStatus) && !data?.verification?.sumsubReviewAnswer;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Verification (KYB)</h1>
          <p className="text-sm text-muted-foreground">
            Verify your organization to unlock policy creation and reserve funding.
          </p>
        </div>
        <Badge variant={meta.variant} className="gap-1">
          <StatusIcon className="h-3.5 w-3.5" />
          {meta.label}
        </Badge>
      </div>

      {verified && (
        <Card className="border-success/40">
          <CardContent className="flex items-start gap-3 py-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-success" />
            <p className="text-sm">Your organization is verified. You can create policies and fund your reserve.</p>
          </CardContent>
        </Card>
      )}

      {pending && (
        <Card>
          <CardContent className="flex items-start gap-3 py-4">
            <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="text-sm">
              <p>Your documents are under review. We'll email you once a decision is made.</p>
              {screeningInProgress && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Automated compliance screening is in progress.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'REJECTED' && data?.verification?.verifierNotes && (
        <Card className="border-destructive">
          <CardContent className="flex items-start gap-3 py-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="text-sm">
              <p className="font-medium">Your submission needs changes</p>
              <p className="text-muted-foreground">{data.verification.verifierNotes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {submittedDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submitted documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {submittedDocs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{d.documentType.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">— {d.fileName}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{submittedDocs.length > 0 ? 'Resubmit documents' : 'Submit your documents'}</CardTitle>
            <CardDescription>
              Required: {requiredItems.map((i) => i.label).join(', ')}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <KYBDocumentUpload
              documents={documents}
              onDocumentsChange={setDocuments}
              requiredTypes={requiredItems.map((i) => i.documentType)}
              satisfiedTypes={satisfiedTypes}
              labels={labels}
            />

            {licenseRequired && (
              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <h4 className="text-sm font-medium">{regulator} operating license</h4>
                  <p className="text-xs text-muted-foreground">
                    Your insurance regulator license number and its expiry date are required.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="license-number">License number</Label>
                    <Input
                      id="license-number"
                      placeholder={`${regulator} license number`}
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="license-expiry">Expiry date</Label>
                    <Input
                      id="license-expiry"
                      type="date"
                      value={licenseExpiry}
                      onChange={(e) => setLicenseExpiry(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={() => submitMutation.mutate(documents)}
              disabled={submitMutation.isPending || missingDocs.length > 0 || licenseMissing}
            >
              {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit for review
            </Button>
            {(missingDocs.length > 0 || licenseMissing) && (
              <p className="text-xs text-muted-foreground">
                {missingDocs.length > 0 &&
                  `Still needed: ${missingDocs.map((i) => i.label).join(', ')}. `}
                {licenseMissing && `Enter your ${regulator} license number and expiry date.`}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
