import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, User, Mail, Phone, Send, FileWarning, CheckCircle, XCircle, Loader2, FileText, ExternalLink, Download } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { KYBStatusBadge } from '@/components/kyb/KYBStatusBadge';
import { KYBVerificationPanel } from '@/components/kyb/KYBVerificationPanel';
import { SendInvitationDialog } from '@/components/platform/SendInvitationDialog';
import { StatusBadge, getStatusVariant } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { organizationTypeLabels } from '@/lib/validations/kyb';
import type { KYBVerificationFormData } from '@/lib/validations/kyb';

export default function KYBApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [invitationSending, setInvitationSending] = useState(false);

  const { data: application, isLoading } = useQuery({
    queryKey: ['kyb-application', applicationId],
    queryFn: () => api.getOrgApplication(applicationId!),
    enabled: !!applicationId,
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: KYBVerificationFormData) => {
      if (!applicationId) throw new Error('No application ID');
      return api.verifyKYB(applicationId, data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['kyb-application', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['kyb-applications'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });

      if (result.organization) {
        toast({
          title: 'Application Approved',
          description: `Organization "${result.organization.name}" has been created.`,
        });
      } else {
        toast({
          title: 'Application Rejected',
          description: 'The applicant has been notified.',
        });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update verification status',
        variant: 'destructive',
      });
    },
  });

  const handleCreateAndSendInvitation = async () => {
    if (!application) return;

    setInvitationSending(true);
    try {
      // First, find the organization that was created for this application
      const orgsResult = await api.getOrganizations();
      const org = orgsResult.data.find(
        (o: any) => o.contactEmail === application.contactEmail && o.name === application.name
      );

      if (!org) {
        throw new Error('Organization not found');
      }

      // Create the invitation
      const invitation = await api.createOrgAdminInvitation({
        organizationId: org.id,
        email: application.contactEmail,
        firstName: application.contactFirstName,
        lastName: application.contactLastName,
      });

      // Send the invitation
      await api.sendOrgAdminInvitation(invitation.id);

      queryClient.invalidateQueries({ queryKey: ['invitations'] });

      toast({
        title: 'Invitation Sent',
        description: `An invitation has been sent to ${application.contactEmail}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setInvitationSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/platform/kyb-review')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to KYB Review
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Application not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isApproved = application.status === 'APPROVED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/platform/kyb-review')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{application.name}</h1>
            <p className="text-muted-foreground">
              Application submitted {formatDate(application.createdAt, 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
        <KYBStatusBadge status={application.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* KYB Verification Panel - show if verification exists, or show documents from application */}
          {application.kybVerification ? (
            <KYBVerificationPanel
              verification={application.kybVerification}
              onVerify={verifyMutation.mutateAsync}
              isLoading={verifyMutation.isPending}
              readonly={application.status !== 'PENDING_REVIEW'}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {(application.businessRegistrationCertUrl || application.taxPinCertUrl) ? (
                    <>
                      <FileText className="h-5 w-5" />
                      Submitted Documents
                    </>
                  ) : (
                    <>
                      <FileWarning className="h-5 w-5 text-warning" />
                      KYB Documents Required
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Show uploaded documents if available */}
                {(application.businessRegistrationCertUrl || application.taxPinCertUrl) ? (
                  <div className="space-y-3">
                    {application.businessRegistrationCertUrl && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-muted p-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">Business Registration Certificate</p>
                            <p className="text-sm text-muted-foreground">
                              {application.businessRegistrationCertName || 'Uploaded document'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={application.businessRegistrationCertUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-3 w-3" />
                              View
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}
                    {application.taxPinCertUrl && (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-muted p-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">Tax PIN Certificate</p>
                            <p className="text-sm text-muted-foreground">
                              {application.taxPinCertName || 'Uploaded document'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <a href={application.taxPinCertUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-3 w-3" />
                              View
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Verification Actions */}
                    {application.status === 'PENDING_REVIEW' && (
                      <div className="pt-4 border-t space-y-4">
                        <p className="text-sm font-medium">Verification Decision:</p>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              const notes = prompt('Enter approval notes (optional):') || '';
                              verifyMutation.mutate({ status: 'APPROVED', reviewNotes: notes });
                            }}
                            disabled={verifyMutation.isPending}
                          >
                            {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              const notes = prompt('Enter rejection reason:');
                              if (notes) {
                                verifyMutation.mutate({ status: 'REJECTED', reviewNotes: notes });
                              }
                            }}
                            disabled={verifyMutation.isPending}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      No KYB documents have been submitted for this application. The applicant needs to upload:
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      <li>Business Registration Certificate</li>
                      <li>Tax PIN Certificate</li>
                    </ul>

                    {application.status === 'PENDING_REVIEW' && (
                      <div className="pt-4 border-t space-y-4">
                        <p className="text-sm font-medium">Administrative Actions:</p>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            onClick={() => {
                              const notes = prompt('Enter rejection reason:');
                              if (notes) {
                                verifyMutation.mutate({ status: 'REJECTED', reviewNotes: notes });
                              }
                            }}
                            disabled={verifyMutation.isPending}
                          >
                            {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject Application
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Note: Cannot approve without KYB documents. You can reject if the application is invalid.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {application.rejectionReason && (
                  <div className="rounded-lg bg-destructive/10 p-4 mt-4">
                    <h4 className="font-medium text-destructive">Rejection Reason</h4>
                    <p className="mt-1 text-sm">{application.rejectionReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Registration Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Registration Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-muted-foreground">Registration Number</label>
                  <p className="font-medium">{application.registrationNumber || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">County</label>
                  <p className="font-medium">{application.county || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Estimated Farmers</label>
                  <p className="font-medium">{application.estimatedFarmers?.toLocaleString() || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Website</label>
                  <p className="font-medium">{application.website || '-'}</p>
                </div>
              </div>
              {application.description && (
                <div>
                  <label className="text-sm text-muted-foreground">Description</label>
                  <p className="text-sm mt-1">{application.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Organization Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <p className="font-medium">{application.name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Type</label>
                <div className="mt-1">
                  <StatusBadge variant={getStatusVariant(application.type)}>
                    {organizationTypeLabels[application.type]}
                  </StatusBadge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Person */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Person
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <p className="font-medium">
                  {application.contactFirstName} {application.contactLastName}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {application.contactEmail}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Phone</label>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {application.contactPhone}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Send Invitation (only show if approved) */}
          {isApproved && (
            <Card>
              <CardHeader>
                <CardTitle>Send Invitation</CardTitle>
                <CardDescription>
                  Send login credentials to the organization admin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SendInvitationDialog
                  organizationName={application.name}
                  contactEmail={application.contactEmail}
                  contactFirstName={application.contactFirstName}
                  contactLastName={application.contactLastName}
                  onCreateAndSend={handleCreateAndSendInvitation}
                  isLoading={invitationSending}
                  trigger={
                    <Button className="w-full">
                      <Send className="mr-2 h-4 w-4" />
                      Send Invitation
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
