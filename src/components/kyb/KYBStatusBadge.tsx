import { StatusBadge } from '@/components/ui/status-badge';
import type { KYBStatus, ApplicationStatus, InvitationStatus } from '@/types';

interface KYBStatusBadgeProps {
  status: KYBStatus | ApplicationStatus | InvitationStatus;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: 'pending' | 'approved' | 'rejected' | 'info' | 'default' }> = {
  PENDING_REVIEW: { label: 'Pending Review', variant: 'pending' },
  VERIFIED: { label: 'Verified', variant: 'approved' },
  REJECTED: { label: 'Rejected', variant: 'rejected' },
  APPROVED: { label: 'Approved', variant: 'approved' },
  PENDING: { label: 'Pending', variant: 'pending' },
  SENT: { label: 'Sent', variant: 'info' },
  ACCEPTED: { label: 'Accepted', variant: 'approved' },
  EXPIRED: { label: 'Expired', variant: 'default' },
};

export function KYBStatusBadge({ status, className }: KYBStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'default' as const };

  return (
    <StatusBadge variant={config.variant} className={className}>
      {config.label}
    </StatusBadge>
  );
}
