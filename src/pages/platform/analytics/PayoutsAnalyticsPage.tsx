import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mockData";
import { StatCard } from "@/components/dashboard/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { PieChart } from "@/components/charts/PieChart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { GranularitySelect } from "@/components/ui/granularity-select";
import { DollarSign, Hash, TrendingUp, CheckCircle } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Granularity } from "@/types";

export default function PayoutsAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const { data } = useQuery({
    queryKey: ["payoutsAnalytics", dateRange, granularity],
    queryFn: () => mockApi.getPayoutsAnalytics(),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payouts Analytics</h1>
          <p className="text-muted-foreground">Track payout performance and success rates</p>
        </div>
        <div className="flex items-center gap-2">
          <GranularitySelect value={granularity} onChange={setGranularity} />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Amount"
          value={formatCurrency(data?.totalAmount ?? 0)}
          icon={DollarSign}
          trend={{ value: 18, isPositive: true }}
        />
        <StatCard
          title="Average Payout"
          value={formatCurrency(data?.avgAmount ?? 0)}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Payouts"
          value={data?.count ?? 0}
          icon={Hash}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Success Rate"
          value={`${((data?.successRate ?? 0) * 100).toFixed(1)}%`}
          icon={CheckCircle}
          trend={{ value: 2, isPositive: true }}
        />
      </div>

      {/* Charts */}
      <AreaChart
        data={data?.timeSeries ?? []}
        xKey="date"
        yKeys={[
          { key: "amount", name: "Amount (KES)", color: "hsl(var(--chart-1))" },
        ]}
        title="Payouts Over Time"
        formatYAxis={(v) => formatCurrency(v)}
        height={300}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <PieChart data={data?.byStatus ?? []} title="Payouts by Status" height={280} />
      </div>
    </div>
  );
}
