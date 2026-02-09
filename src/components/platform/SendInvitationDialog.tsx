import { useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import type { OrgAdminInvitation } from '@/types';

interface SendInvitationDialogProps {
  invitation?: OrgAdminInvitation | null;
  organizationName?: string;
  contactEmail?: string;
  contactFirstName?: string;
  contactLastName?: string;
  onCreateAndSend?: () => Promise<OrgAdminInvitation>;
  onSend?: (invitationId: string) => Promise<void>;
  isLoading?: boolean;
  trigger?: React.ReactNode;
}

export function SendInvitationDialog({
  invitation,
  organizationName,
  contactEmail,
  contactFirstName,
  contactLastName,
  onCreateAndSend,
  onSend,
  isLoading = false,
  trigger,
}: SendInvitationDialogProps) {
  const [open, setOpen] = useState(false);

  const email = invitation?.email || contactEmail || '';
  const firstName = invitation?.firstName || contactFirstName || '';
  const lastName = invitation?.lastName || contactLastName || '';
  const orgName = invitation?.organizationName || organizationName || '';

  const handleSend = async () => {
    if (invitation && onSend) {
      await onSend(invitation.id);
    } else if (onCreateAndSend) {
      await onCreateAndSend();
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Send className="mr-2 h-4 w-4" />
            Send Invitation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Admin Invitation</DialogTitle>
          <DialogDescription>
            Preview and confirm the invitation email
          </DialogDescription>
        </DialogHeader>

        {/* Email Preview */}
        <Card className="bg-muted">
          <CardContent className="p-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>To: {email}</span>
              </div>

              <div className="border-b pb-2 font-medium">
                You've been invited to join {orgName} on MicroCrop
              </div>

              <div className="space-y-2 text-muted-foreground">
                <p>Hello {firstName},</p>
                <p>
                  You have been invited to become an administrator for{' '}
                  <strong className="text-foreground">{orgName}</strong> on the MicroCrop platform.
                </p>
                <p>
                  Click the link below to set up your password and access your organization dashboard:
                </p>
                <div className="rounded bg-background p-2 font-mono text-xs">
                  https://microcrop.io/accept-invitation/[secure-token]
                </div>
                <p className="text-xs">
                  This invitation will expire in 7 days.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-info/50 bg-info/10 p-3 text-sm text-info">
          The recipient will receive an email with a secure link to set their password and access
          the platform.
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
