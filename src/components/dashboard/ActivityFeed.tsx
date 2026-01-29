import { cn } from "@/lib/utils";
import { Activity, ActivityType } from "@/types";
import {
  Users,
  FileCheck,
  MapPin,
  FileText,
  CheckCircle,
  XCircle,
  DollarSign,
  UserPlus,
  Building2,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow, isValid } from "date-fns";

function formatActivityTime(dateValue: string | Date | undefined | null): string {
  if (!dateValue) return "Recently";

  const date = new Date(dateValue);
  if (!isValid(date)) return "Recently";

  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "Recently";
  }
}

interface ActivityFeedProps {
  activities: Activity[];
  className?: string;
  maxItems?: number;
}

const activityIcons: Record<ActivityType, React.ElementType> = {
  FARMER_REGISTERED: Users,
  FARMER_KYC_UPDATED: FileCheck,
  PLOT_CREATED: MapPin,
  POLICY_CREATED: FileText,
  POLICY_ACTIVATED: CheckCircle,
  POLICY_CANCELLED: XCircle,
  PAYOUT_INITIATED: DollarSign,
  PAYOUT_COMPLETED: CheckCircle,
  PAYOUT_FAILED: AlertCircle,
  STAFF_INVITED: UserPlus,
  STAFF_ACTIVATED: UserPlus,
  ORG_CREATED: Building2,
  ORG_ACTIVATED: Building2,
};

const activityColors: Record<ActivityType, string> = {
  FARMER_REGISTERED: "text-info bg-info/10",
  FARMER_KYC_UPDATED: "text-warning bg-warning/10",
  PLOT_CREATED: "text-success bg-success/10",
  POLICY_CREATED: "text-primary bg-primary/10",
  POLICY_ACTIVATED: "text-success bg-success/10",
  POLICY_CANCELLED: "text-muted-foreground bg-muted",
  PAYOUT_INITIATED: "text-info bg-info/10",
  PAYOUT_COMPLETED: "text-success bg-success/10",
  PAYOUT_FAILED: "text-error bg-error/10",
  STAFF_INVITED: "text-info bg-info/10",
  STAFF_ACTIVATED: "text-success bg-success/10",
  ORG_CREATED: "text-primary bg-primary/10",
  ORG_ACTIVATED: "text-success bg-success/10",
};

export function ActivityFeed({ activities, className, maxItems }: ActivityFeedProps) {
  const displayActivities = maxItems ? activities.slice(0, maxItems) : activities;

  if (displayActivities.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-8 text-muted-foreground", className)}>
        No recent activity
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {displayActivities.map((activity) => {
        const Icon = activityIcons[activity.type] || AlertCircle;
        const colorClass = activityColors[activity.type] || "text-muted-foreground bg-muted";
        
        return (
          <div key={activity.id} className="flex items-start gap-3">
            <div className={cn("rounded-full p-2", colorClass)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm leading-tight">{activity.message}</p>
              <p className="text-xs text-muted-foreground">
                {formatActivityTime(activity.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
