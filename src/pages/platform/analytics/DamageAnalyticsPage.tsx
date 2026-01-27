import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mockData";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Cloud, Satellite, Gauge, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { ColumnDef } from "@tanstack/react-table";
import { DamageAssessment } from "@/types";
import { format } from "date-fns";

const columns: ColumnDef<DamageAssessment>[] = [
  {
    accessorKey: "policyNumber",
    header: "Policy",
  },
  {
    accessorKey: "plotName",
    header: "Plot",
  },
  {
    accessorKey: "weatherDamageScore",
    header: "Weather Score",
    cell: ({ row }) => `${(row.getValue("weatherDamageScore") as number * 100).toFixed(0)}%`,
  },
  {
    accessorKey: "satelliteDamageScore",
    header: "Satellite Score",
    cell: ({ row }) => `${(row.getValue("satelliteDamageScore") as number * 100).toFixed(0)}%`,
  },
  {
    accessorKey: "combinedDamageScore",
    header: "Combined Score",
    cell: ({ row }) => {
      const score = row.getValue("combinedDamageScore") as number;
      const percentage = score * 100;
      return (
        <span className={
          percentage >= 60 ? "text-error font-medium" :
          percentage >= 30 ? "text-warning font-medium" :
          "text-success"
        }>
          {percentage.toFixed(0)}%
        </span>
      );
    },
  },
  {
    accessorKey: "isTriggered",
    header: "Triggered",
    cell: ({ row }) => (
      <StatusBadge variant={row.getValue("isTriggered") ? "success" : "default"}>
        {row.getValue("isTriggered") ? "Yes" : "No"}
      </StatusBadge>
    ),
  },
  {
    accessorKey: "assessmentDate",
    header: "Date",
    cell: ({ row }) => format(new Date(row.getValue("assessmentDate")), "MMM d, yyyy"),
  },
];

export default function DamageAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["damageAnalytics", dateRange],
    queryFn: () => mockApi.getDamageAnalytics(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Damage Analytics</h1>
          <p className="text-muted-foreground">Track damage assessments and trigger rates</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Avg Weather Score"
          value={`${((data?.avgWeatherScore ?? 0) * 100).toFixed(0)}%`}
          icon={Cloud}
        />
        <StatCard
          title="Avg Satellite Score"
          value={`${((data?.avgSatelliteScore ?? 0) * 100).toFixed(0)}%`}
          icon={Satellite}
        />
        <StatCard
          title="Avg Combined Score"
          value={`${((data?.avgCombinedScore ?? 0) * 100).toFixed(0)}%`}
          icon={Gauge}
        />
        <StatCard
          title="Trigger Rate"
          value={`${((data?.triggerRate ?? 0) * 100).toFixed(0)}%`}
          icon={AlertTriangle}
          trend={{ value: 5, isPositive: false }}
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.assessments ?? []}
        isLoading={isLoading}
        searchKey="policyNumber"
        searchPlaceholder="Search by policy number..."
      />
    </div>
  );
}
