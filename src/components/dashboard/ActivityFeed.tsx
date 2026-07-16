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
import { formatCurrency } from "@/lib/market";
import {
  useDemoMode,
  useActivityStream,
  type DemoEvent,
  type MarketCode,
} from "@/lib/demo";

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
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
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

// ---------------------------------------------------------------------------
// LiveActivityFeed — additive, demo-mode-only streaming variant.
//
// When demo mode is OFF it renders the plain <ActivityFeed/> with the exact
// props passed in (real data, no animation). When ON it ignores the static
// `activities` and streams simulated KE + GH events from `useActivityStream`,
// each new item animating in at the top of the list.
// ---------------------------------------------------------------------------

const MARKET_FLAG: Record<MarketCode, string> = {
  KE: "🇰🇪",
  GH: "🇬🇭",
};

const demoTypeToActivityType: Record<DemoEvent["type"], ActivityType> = {
  policy: "POLICY_CREATED",
  determination: "FARMER_KYC_UPDATED",
  payout: "PAYOUT_COMPLETED",
};

const demoTypeIcon: Record<DemoEvent["type"], React.ElementType> = {
  policy: FileText,
  determination: FileText,
  payout: DollarSign,
};

function demoEventTitle(event: DemoEvent): string {
  switch (event.type) {
    case "policy":
      return "New policy issued";
    case "determination":
      return event.peril
        ? `${event.peril[0].toUpperCase()}${event.peril.slice(1)} index determination`
        : "Index determination";
    case "payout":
      return event.peril
        ? `${event.peril[0].toUpperCase()}${event.peril.slice(1)} payout sent`
        : "Payout sent";
  }
}

export function LiveActivityFeed({ activities, className, maxItems }: ActivityFeedProps) {
  const { enabled } = useDemoMode();
  if (!enabled) {
    return <ActivityFeed activities={activities} className={className} maxItems={maxItems} />;
  }
  return <LiveActivityFeedInner className={className} maxItems={maxItems} />;
}

function LiveActivityFeedInner({ className, maxItems }: Omit<ActivityFeedProps, "activities">) {
  const events = useActivityStream({ max: maxItems ?? 6 });

  if (events.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-8 text-muted-foreground", className)}>
        Awaiting live activity…
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {events.map((event) => {
        const Icon = demoTypeIcon[event.type] || AlertCircle;
        const colorClass =
          activityColors[demoTypeToActivityType[event.type]] || "text-muted-foreground bg-muted";

        return (
          <div key={event.id} className="flex animate-slide-up items-start gap-3">
            <div className={cn("rounded-full p-2", colorClass)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm leading-tight">
                <span className="font-medium">{demoEventTitle(event)}</span>
                <span className="text-muted-foreground"> · {event.farmerMasked}</span>
              </p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <span aria-hidden="true">{MARKET_FLAG[event.market]}</span>
                <span>{event.region}</span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{event.crop}</span>
                {event.amount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium tabular-nums text-foreground/80">
                      {formatCurrency(event.amount, event.currency)}
                    </span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatActivityTime(new Date(event.ts))}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
