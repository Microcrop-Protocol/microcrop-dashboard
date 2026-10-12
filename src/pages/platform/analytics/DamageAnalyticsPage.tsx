import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { AnalyticsHeader } from "@/components/platform/AnalyticsHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Satellite, Gauge, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { ColumnDef } from "@tanstack/react-table";
import type { DamageAssessmentRow } from "@/types";
import { formatDate } from "@/lib/utils";
import { useMarketFilter } from "@/hooks/useMarketFilter";
import { dateRangeParams, defaultAnalyticsRange, formatRatio } from "@/lib/platform-analytics";

const pct = (value: number) => `${(value * 100).toFixed(0)}%`;

const columns: ColumnDef<DamageAssessmentRow>[] = [
  {
    accessorKey: "policyNumber",
    header: "Policy",
  },
  {
    accessorKey: "weatherDamage",
    header: "Weather Score",
    cell: ({ row }) => pct(row.original.weatherDamage),
  },
  {
    accessorKey: "satelliteDamage",
    header: "Satellite Score",
    cell: ({ row }) => pct(row.original.satelliteDamage),
  },
  {
    accessorKey: "combinedDamage",
    header: "Combined Score",
    cell: ({ row }) => {
      const percentage = row.original.combinedDamage * 100;
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
    accessorKey: "triggered",
    header: "Triggered",
    cell: ({ row }) => (
      <StatusBadge variant={row.original.triggered ? "success" : "default"}>
        {row.original.triggered ? "Yes" : "No"}
      </StatusBadge>
    ),
  },
  {
    accessorKey: "triggerDate",
    header: "Date",
    cell: ({ row }) => (row.original.triggerDate ? formatDate(row.original.triggerDate) : "—"),
  },
];

/** Damage scores are ratios, not money, so "All markets" is meaningful here. */
export default function DamageAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultAnalyticsRange);
  const marketFilter = useMarketFilter("any");
  const { countryCode } = marketFilter;
  const range = dateRangeParams(dateRange);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["damageAnalytics", countryCode ?? "ALL", range.startDate, range.endDate],
    queryFn: () => api.getDamageAnalytics({ countryCode, ...range }),
  });

  const score = (v: number | undefined) => (isLoading ? "—" : formatRatio(v ?? 0, 0));

  return (
    <div className="space-y-6">
      <AnalyticsHeader
        title="Damage Analytics"
        description={`Damage assessments and trigger rates — ${marketFilter.market?.countryName ?? "all markets"}`}
        mode="any"
        marketFilter={marketFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            We couldn't load damage assessments. Please try again.
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Avg Weather Score" value={score(data?.avgWeather)} icon={Cloud} />
        <StatCard title="Avg Satellite Score" value={score(data?.avgSatellite)} icon={Satellite} />
        <StatCard title="Avg Combined Score" value={score(data?.avgCombined)} icon={Gauge} />
        <StatCard title="Trigger Rate" value={score(data?.triggerRate)} icon={AlertTriangle} />
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
