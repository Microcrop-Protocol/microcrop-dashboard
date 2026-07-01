import { StatusBadge } from '@/components/ui/status-badge';
import type { KYBStatus, ApplicationStatus, InvitationStatus, VerificationStatus } from '@/types';

interface KYBStatusBadgeProps {
  status: KYBStatus | ApplicationStatus | InvitationStatus | VerificationStatus;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: 'pending' | 'approved' | 'rejected' | 'info' | 'default' }> = {
  PENDING_REVIEW: { label: 'Pending Review', variant: 'pending' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'pending' },
  KYB_REQUIRED: { label: 'KYB Required', variant: 'pending' },
  KYB_IN_PROGRESS: { label: 'KYB In Progress', variant: 'info' },
  KYB_SUBMITTED: { label: 'KYB Submitted', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  DOCUMENTS_REQUIRED: { label: 'Documents Required', variant: 'pending' },
  VERIFIED: { label: 'Verified', variant: 'approved' },
  REJECTED: { label: 'Rejected', variant: 'rejected' },
  APPROVED: { label: 'Approved', variant: 'approved' },
  PENDING: { label: 'Pending', variant: 'pending' },
  ACCEPTED: { label: 'Accepted', variant: 'approved' },
  EXPIRED: { label: 'Expired', variant: 'default' },
  REVOKED: { label: 'Revoked', variant: 'default' },
};

export function KYBStatusBadge({ status, className }: KYBStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'default' as const };

  return (
    <StatusBadge variant={config.variant} className={className}>
      {config.label}
    </StatusBadge>
  );
}
