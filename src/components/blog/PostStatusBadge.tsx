import { StatusBadge } from '@/components/ui/status-badge';
import type { PostStatus } from '@/types';

const variantMap: Record<PostStatus, 'active' | 'pending' | 'expired' | 'info'> = {
  PUBLISHED: 'active',
  DRAFT: 'pending',
  SCHEDULED: 'info',
  UNPUBLISHED: 'expired',
};

const labelMap: Record<PostStatus, string> = {
  PUBLISHED: 'Published',
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  UNPUBLISHED: 'Unpublished',
};

export function PostStatusBadge({ status }: { status: PostStatus }) {
  return <StatusBadge variant={variantMap[status]}>{labelMap[status]}</StatusBadge>;
}
