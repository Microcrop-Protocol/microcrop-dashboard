import { LucideIcon, FileX2, Users, FileText, Wallet, Map, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = FileX2,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}

// Pre-configured empty states for common use cases
export function EmptyFarmers({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No farmers yet"
      description="Start by adding farmers to your organization. You can add them one by one or import in bulk."
      actionLabel="Add Farmer"
      onAction={onAction}
    />
  );
}

export function EmptyPolicies({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No policies found"
      description="Create your first insurance policy to start protecting farmers against crop damage."
      actionLabel="Create Policy"
      onAction={onAction}
    />
  );
}

export function EmptyPayouts() {
  return (
    <EmptyState
      icon={Wallet}
      title="No payouts yet"
      description="Payouts will appear here when policies are triggered due to damage assessments."
    />
  );
}

export function EmptyPlots({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Map}
      title="No plots registered"
      description="Import farmer data with plot information to see them on the map."
      actionLabel="Import Data"
      onAction={onAction}
    />
  );
}

export function EmptyActivity() {
  return (
    <EmptyState
      icon={Activity}
      title="No activity yet"
      description="Activity will be logged here as you and your team use the platform."
    />
  );
}
