import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mockData";
import { StatCard } from "@/components/dashboard/StatCard";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { GranularitySelect } from "@/components/ui/granularity-select";
import { FileText, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Granularity } from "@/types";

export default function PoliciesAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const { data } = useQuery({
    queryKey: ["policiesAnalytics", dateRange, granularity],
    queryFn: () => mockApi.getPoliciesAnalytics(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policies Analytics</h1>
          <p className="text-muted-foreground">Track policy creation and status trends</p>
        </div>
        <div className="flex items-center gap-2">
          <GranularitySelect value={granularity} onChange={setGranularity} />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Policies"
          value={data?.totalPolicies?.toLocaleString() ?? 0}
          icon={FileText}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Active Policies"
          value={data?.activePolicies?.toLocaleString() ?? 0}
          icon={CheckCircle}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Claims Ratio"
          value={`${((data?.claimsRatio ?? 0) * 100).toFixed(1)}%`}
          icon={AlertTriangle}
          trend={{ value: 2, isPositive: false }}
        />
        <StatCard
          title="New This Period"
          value="341"
          icon={TrendingUp}
          trend={{ value: 15, isPositive: true }}
        />
      </div>

      {/* Charts */}
      <LineChart
        data={data?.timeSeries ?? []}
        xKey="date"
        yKeys={[{ key: "value", name: "Policies Created", color: "hsl(var(--chart-1))" }]}
        title="Policies Created Over Time"
        height={300}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <PieChart data={data?.byStatus ?? []} title="Policies by Status" height={280} />
        <BarChart data={data?.byCoverage ?? []} xKey="name" title="Policies by Coverage Type" height={280} />
      </div>
    </div>
  );
}
