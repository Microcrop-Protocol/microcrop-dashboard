import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, Download, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { KYBStatusBadge } from './KYBStatusBadge';
import type { KYBVerification, KYBDocument } from '@/types';
import { kybVerificationSchema, type KYBVerificationFormData, documentTypeLabels } from '@/lib/validations/kyb';
import { formatDate } from '@/lib/utils';

interface KYBVerificationPanelProps {
  verification: KYBVerification;
  onVerify: (data: KYBVerificationFormData) => Promise<void>;
  isLoading?: boolean;
  readonly?: boolean;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function DocumentCard({ document }: { document: KYBDocument }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-medium">{documentTypeLabels[document.type]}</h4>
              <p className="text-sm text-muted-foreground">{document.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(document.fileSize)} | Uploaded{' '}
                {formatDate(document.uploadedAt, 'MMM d, yyyy HH:mm')}
              </p>
              {document.verifiedAt && (
                <p className="mt-1 text-xs text-success">
                  Verified on {formatDate(document.verifiedAt, 'MMM d, yyyy HH:mm')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={document.fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" />
                View
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={document.fileUrl} download={document.fileName}>
                <Download className="mr-1 h-3 w-3" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KYBVerificationPanel({
  verification,
  onVerify,
  isLoading = false,
  readonly = false,
}: KYBVerificationPanelProps) {
  const [selectedAction, setSelectedAction] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const form = useForm<KYBVerificationFormData>({
    resolver: zodResolver(kybVerificationSchema),
    defaultValues: {
      status: undefined,
      reviewNotes: '',
    },
  });

  const handleSubmit = async (data: KYBVerificationFormData) => {
    await onVerify(data);
    setSelectedAction(null);
    form.reset();
  };

  const isPending = verification.status === 'PENDING_REVIEW';

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">KYB Verification</h3>
          <p className="text-sm text-muted-foreground">
            Submitted on {formatDate(verification.submittedAt, 'MMMM d, yyyy')}
          </p>
        </div>
        <KYBStatusBadge status={verification.status} />
      </div>

      {/* Documents */}
      <div className="space-y-3">
        <h4 className="font-medium">Submitted Documents</h4>
        {verification.documents.map((doc) => (
          <DocumentCard key={doc.id} document={doc} />
        ))}
      </div>

      {/* Review Notes (if already reviewed) */}
      {verification.reviewNotes && (
        <div className="rounded-lg bg-muted p-4">
          <h4 className="font-medium">Review Notes</h4>
          <p className="mt-1 text-sm text-muted-foreground">{verification.reviewNotes}</p>
          {verification.reviewedAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Reviewed on {formatDate(verification.reviewedAt, 'MMM d, yyyy HH:mm')}
            </p>
          )}
        </div>
      )}

      {/* Verification Actions */}
      {isPending && !readonly && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Decision</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedAction ? (
              <div className="flex gap-4">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setSelectedAction('APPROVED');
                    form.setValue('status', 'APPROVED');
                  }}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    setSelectedAction('REJECTED');
                    form.setValue('status', 'REJECTED');
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div
                    className={`rounded-lg p-3 ${
                      selectedAction === 'APPROVED'
                        ? 'bg-success/10 text-success'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {selectedAction === 'APPROVED'
                      ? 'You are about to APPROVE this application. The organization will be created and ready for invitation.'
                      : 'You are about to REJECT this application. The applicant will need to resubmit.'}
                  </div>

                  <FormField
                    control={form.control}
                    name="reviewNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Review Notes {selectedAction === 'REJECTED' && '(Recommended)'}
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={
                              selectedAction === 'REJECTED'
                                ? 'Please provide a reason for rejection...'
                                : 'Add any notes about this verification...'
                            }
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedAction(null);
                        form.reset();
                      }}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant={selectedAction === 'APPROVED' ? 'default' : 'destructive'}
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirm {selectedAction === 'APPROVED' ? 'Approval' : 'Rejection'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
