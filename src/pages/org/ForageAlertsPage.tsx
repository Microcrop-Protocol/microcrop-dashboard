import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Sprout, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import type { ForageAlert, ForageAlertStatus } from "@/types";

// ForageAlertStatus -> StatusBadge variant (reuse the shared status palette).
const statusVariant = (status: ForageAlertStatus) => {
  switch (status) {
    case "TRIGGERED":
      return getStatusVariant("pending");
    case "PROCESSING":
      return getStatusVariant("processing");
    case "COMPLETED":
      return getStatusVariant("completed");
    case "FAILED":
      return getStatusVariant("failed");
    default:
      return getStatusVariant(status);
  }
};

const columns: ColumnDef<ForageAlert>[] = [
  {
    id: "unit",
    header: "Insurance Unit",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.insuranceUnit?.county ?? "—"}</div>
        <div className="text-sm text-muted-foreground">
          {row.original.insuranceUnit?.unitCode ?? row.original.insuranceUnitId}
          {row.original.insuranceUnit?.country ? ` · ${row.original.insuranceUnit.country}` : ""}
        </div>
      </div>
    ),
  },
  {
    id: "season",
    header: "Season",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.season} {row.original.year}
      </span>
    ),
  },
  {
    id: "deficit",
    header: "Forage Deficit",
    cell: ({ row }) => (
      <div className="text-sm">
        <div className="font-medium">{Number(row.original.deficitPercent).toFixed(1)}%</div>
        <div className="text-muted-foreground">
          NDVI {Number(row.original.cumulativeNDVI).toFixed(3)} / strike {Number(row.original.strikeLevel).toFixed(3)}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "policiesAffected",
    header: "Policies",
    cell: ({ row }) => row.original.policiesAffected.toLocaleString(),
  },
  {
    id: "payout",
    header: "Total Payout",
    cell: ({ row }) => `$${row.original.totalPayoutUSDC.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge variant={statusVariant(row.original.status)}>{row.original.status}</StatusBadge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Triggered",
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">{formatDate(row.getValue("createdAt"))}</div>
    ),
  },
];

export default function ForageAlertsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["forage-alerts"],
    queryFn: () => api.getForageAlerts(),
    retry: 1,
  });

  const alerts = data?.data ?? [];
  const active = alerts.filter((a) => a.status === "TRIGGERED" || a.status === "PROCESSING").length;
  const completed = alerts.filter((a) => a.status === "COMPLETED").length;
  const totalPayout = alerts.reduce((s, a) => s + (a.totalPayoutUSDC || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Forage Alerts</h1>
        <p className="text-muted-foreground">
          NDVI-driven forage-failure alerts for your livestock (IBLI) insurance units.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Active Alerts" value={active} icon={AlertTriangle} />
        <StatCard title="Completed" value={completed} icon={CheckCircle} />
        <StatCard
          title="Total Payout"
          value={`$${totalPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={Sprout}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">
          Failed to load forage alerts. Please try again.
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Sprout className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No forage alerts</p>
          <p className="text-sm text-muted-foreground">
            Alerts appear here when NDVI in a covered insurance unit drops below its forage strike level.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={alerts} isLoading={false} />
      )}
    </div>
  );
}
