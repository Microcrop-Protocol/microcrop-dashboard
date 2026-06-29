import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KYBDocumentUpload } from '@/components/kyb/KYBDocumentUpload';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, ShieldAlert, Clock, Loader2, FileText } from 'lucide-react';
import type { KYBDocumentType } from '@/types';

interface UploadedDocument {
  file: File;
  type: KYBDocumentType;
  preview?: string;
}

// Dashboard KYB doc type -> backend multipart field name.
const FIELD_FOR: Record<KYBDocumentType, string> = {
  BUSINESS_REGISTRATION_CERT: 'businessRegistrationCert',
  TAX_PIN_CERT: 'taxPinCert',
};

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['my-kyb'],
    queryFn: () => api.getMyKyb(),
  });

  const submitMutation = useMutation({
    mutationFn: async (docs: UploadedDocument[]) => {
      const fd = new FormData();
      for (const d of docs) fd.append(FIELD_FOR[d.type], d.file);
      return api.submitMyKyb(fd);
    },
    onSuccess: () => {
      toast({ title: 'KYB submitted', description: 'Your documents are now under review.' });
      setDocuments([]);
      queryClient.invalidateQueries({ queryKey: ['my-kyb'] });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
    onError: (e: Error) => toast({ title: 'Submission failed', description: e.message, variant: 'destructive' }),
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
            <p className="text-sm">Your documents are under review. We'll email you once a decision is made.</p>
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
            <CardDescription>Business registration certificate and tax PIN certificate are required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <KYBDocumentUpload
              documents={documents}
              onDocumentsChange={setDocuments}
              requiredTypes={['BUSINESS_REGISTRATION_CERT', 'TAX_PIN_CERT']}
            />
            <Button
              onClick={() => submitMutation.mutate(documents)}
              disabled={submitMutation.isPending || documents.length < 2}
            >
              {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit for review
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
