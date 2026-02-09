import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { GranularitySelect } from "@/components/ui/granularity-select";
import { DollarSign, TrendingUp, Wallet, ArrowDownUp } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Granularity } from "@/types";

export default function RevenueAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const { data } = useQuery({
    queryKey: ["revenueAnalytics", dateRange, granularity],
    queryFn: () => api.getRevenueAnalytics(),
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
          <h1 className="text-2xl font-bold">Revenue Analytics</h1>
          <p className="text-muted-foreground">Track platform revenue and financial performance</p>
        </div>
        <div className="flex items-center gap-2">
          <GranularitySelect value={granularity} onChange={setGranularity} />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Fees"
          value={formatCurrency(data?.totalFees ?? 0)}
          icon={DollarSign}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Total Premiums"
          value={formatCurrency(data?.totalPremiums ?? 0)}
          icon={Wallet}
          trend={{ value: 22, isPositive: true }}
        />
        <StatCard
          title="Total Payouts"
          value={formatCurrency(data?.totalPayouts ?? 0)}
          icon={ArrowDownUp}
          trend={{ value: 8, isPositive: false }}
        />
        <StatCard
          title="Net Revenue"
          value={formatCurrency(data?.netRevenue ?? 0)}
          icon={TrendingUp}
          trend={{ value: 18, isPositive: true }}
        />
      </div>

      {/* Charts */}
      <AreaChart
        data={data?.timeSeries ?? []}
        xKey="date"
        yKeys={[
          { key: "premiums", name: "Premiums", color: "hsl(var(--chart-1))" },
          { key: "payouts", name: "Payouts", color: "hsl(var(--chart-2))" },
          { key: "fees", name: "Fees", color: "hsl(var(--chart-3))" },
        ]}
        title="Revenue Over Time"
        stacked
        formatYAxis={(v) => formatCurrency(v)}
        height={350}
      />

      <BarChart
        data={data?.byOrganization ?? []}
        xKey="name"
        title="Revenue by Organization"
        horizontal
        height={300}
      />
    </div>
  );
}
