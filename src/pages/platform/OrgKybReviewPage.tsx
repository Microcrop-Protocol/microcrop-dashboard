import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { notifySuccess, notifyError } from '@/lib/notify';
import { resolveFileUrl } from '@/lib/utils';
import { FileText, Loader2, ShieldCheck, ShieldAlert, ExternalLink, ScanSearch } from 'lucide-react';
import type { OrgKybVerification } from '@/types';

/**
 * Sumsub KYB/AML screening verdict. Advisory context for the reviewer — GREEN means
 * the automated checks passed, RED blocks approval (backend enforces it too), and a
 * pending status means checks are still running. Absent when screening never ran.
 */
function ScreeningBadge({ verification }: { verification: OrgKybVerification | null }) {
  if (!verification) return null;
  const answer = verification.sumsubReviewAnswer;
  if (answer === 'GREEN') {
    return (
      <Badge className="gap-1 bg-success text-success-foreground hover:bg-success">
        <ScanSearch className="h-3 w-3" /> Screening: GREEN
      </Badge>
    );
  }
  if (answer === 'RED') {
    return (
      <Badge variant="destructive" className="gap-1">
        <ScanSearch className="h-3 w-3" /> Screening: RED
      </Badge>
    );
  }
  if (verification.sumsubReviewStatus) {
    return (
      <Badge variant="secondary" className="gap-1">
        <ScanSearch className="h-3 w-3" /> Screening pending
      </Badge>
    );
  }
  return null;
}

export default function OrgKybReviewPage() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { data: reviews, isLoading, isError } = useQuery({
    queryKey: ['kyb-reviews'],
    queryFn: () => api.getKybReviews(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ orgId, decision, notes }: { orgId: string; decision: 'APPROVED' | 'REJECTED'; notes?: string }) =>
      api.reviewOrgKyb(orgId, decision, notes),
    onSuccess: (_r, vars) => {
      notifySuccess(
        vars.decision === 'APPROVED' ? 'Organization verified' : 'KYB rejected',
        vars.decision === 'APPROVED' ? 'The org can now go live.' : 'The org has been asked to resubmit.',
      );
      setRejecting(null);
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['kyb-reviews'] });
    },
    onError: (e) => notifyError(e, "Couldn't record the KYB decision."),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const items = Array.isArray(reviews) ? reviews : [];

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">KYB Review</h1>
          <p className="text-sm text-muted-foreground">Organizations awaiting KYB verification.</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            We couldn't load KYB reviews. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">KYB Review</h1>
        <p className="text-sm text-muted-foreground">Organizations awaiting KYB verification.</p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8" />
            No organizations are awaiting review.
          </CardContent>
        </Card>
      ) : (
        items.map((org) => (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  <CardDescription>
                    {org.type} · Reg {org.registrationNumber}
                    {org.county ? ` · ${org.county}` : ''}
                  </CardDescription>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {org.contactPerson} · {org.contactEmail} · {org.contactPhone}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary">{(org.kybStatus ?? '').replace(/_/g, ' ')}</Badge>
                  <ScreeningBadge verification={org.kybVerification} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {org.kybVerification?.regulatorLicenseNumber && (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <span className="font-medium">
                    {org.kybVerification.regulator ?? 'Regulator'} license:
                  </span>{' '}
                  {org.kybVerification.regulatorLicenseNumber}
                  {org.kybVerification.licenseExpiresAt && (
                    <span className="text-muted-foreground">
                      {' '}· expires {new Date(org.kybVerification.licenseExpiresAt).toLocaleDateString()}
                    </span>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Check this number against the {org.kybVerification.regulator ?? 'regulator'}'s
                    register of licensed insurers before approving.
                  </p>
                </div>
              )}

              {org.kybVerification?.sumsubReviewAnswer === 'RED' && (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">Compliance screening flagged this organization</p>
                  {(org.kybVerification.sumsubReviewPayload?.reviewResult?.rejectLabels?.length ?? 0) > 0 && (
                    <p className="mt-1 text-muted-foreground">
                      Reasons: {org.kybVerification.sumsubReviewPayload?.reviewResult?.rejectLabels?.join(', ')}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Approval is blocked until the screening is resolved in Sumsub and a new GREEN result arrives.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {(org.kybVerification?.documents ?? []).map((d) => (
                  <a
                    key={d.id}
                    href={resolveFileUrl(d.fileUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {d.documentType.replace(/_/g, ' ')} — {d.fileName}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
                {(org.kybVerification?.documents?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">No documents submitted.</p>
                )}
              </div>

              {rejecting === org.id ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Reason for rejection (sent to the org)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      disabled={reviewMutation.isPending || !notes.trim()}
                      onClick={() => reviewMutation.mutate({ orgId: org.id, decision: 'REJECTED', notes })}
                    >
                      Confirm rejection
                    </Button>
                    <Button variant="outline" onClick={() => { setRejecting(null); setNotes(''); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    disabled={reviewMutation.isPending || org.kybVerification?.sumsubReviewAnswer === 'RED'}
                    onClick={() => reviewMutation.mutate({ orgId: org.id, decision: 'APPROVED' })}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" /> Approve
                  </Button>
                  <Button variant="outline" onClick={() => { setRejecting(org.id); setNotes(''); }}>
                    <ShieldAlert className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
