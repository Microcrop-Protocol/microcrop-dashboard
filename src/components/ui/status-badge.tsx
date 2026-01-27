import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        // General status
        default: "bg-muted text-muted-foreground",
        success: "bg-success/10 text-success border border-success/20",
        warning: "bg-warning/10 text-warning-foreground border border-warning/20",
        error: "bg-error/10 text-error border border-error/20",
        info: "bg-info/10 text-info border border-info/20",
        
        // Specific status types
        active: "bg-success/10 text-success border border-success/20",
        pending: "bg-warning/10 text-warning-foreground border border-warning/20",
        failed: "bg-error/10 text-error border border-error/20",
        expired: "bg-muted text-muted-foreground border border-border",
        cancelled: "bg-muted text-muted-foreground border border-border",
        
        // KYC status
        approved: "bg-success/10 text-success border border-success/20",
        rejected: "bg-error/10 text-error border border-error/20",
        
        // Payout status
        completed: "bg-success/10 text-success border border-success/20",
        processing: "bg-info/10 text-info border border-info/20",
        
        // Policy status
        claimed: "bg-info/10 text-info border border-info/20",
        
        // Role badges
        platform_admin: "bg-primary/10 text-primary border border-primary/20",
        org_admin: "bg-chart-4/10 text-chart-4 border border-chart-4/20",
        org_staff: "bg-info/10 text-info border border-info/20",
        
        // Org type badges
        cooperative: "bg-success/10 text-success border border-success/20",
        aggregator: "bg-info/10 text-info border border-info/20",
        insurer: "bg-chart-4/10 text-chart-4 border border-chart-4/20",
        government: "bg-warning/10 text-warning-foreground border border-warning/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
}

export function StatusBadge({ className, variant, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}

// Helper function to get variant from status string
export function getStatusVariant(status: string): StatusBadgeProps['variant'] {
  const statusLower = status.toLowerCase().replace(/_/g, '');
  
  const statusMap: Record<string, StatusBadgeProps['variant']> = {
    // General
    active: 'active',
    inactive: 'expired',
    pending: 'pending',
    
    // KYC
    approved: 'approved',
    rejected: 'rejected',
    
    // Policy
    expired: 'expired',
    cancelled: 'cancelled',
    claimed: 'claimed',
    
    // Payout
    completed: 'completed',
    processing: 'processing',
    failed: 'failed',
    
    // Roles
    platformadmin: 'platform_admin',
    orgadmin: 'org_admin',
    orgstaff: 'org_staff',
    
    // Org types
    cooperative: 'cooperative',
    aggregator: 'aggregator',
    insurer: 'insurer',
    government: 'government',
  };
  
  return statusMap[statusLower] || 'default';
}
