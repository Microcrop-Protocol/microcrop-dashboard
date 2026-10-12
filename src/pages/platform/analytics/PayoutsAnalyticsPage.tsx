import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { PieChart } from "@/components/charts/PieChart";
import { SettlementBreakdownCard } from "@/components/payouts/SettlementBreakdownCard";
import { AnalyticsHeader } from "@/components/platform/AnalyticsHeader";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Hash, TrendingUp, CheckCircle } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Granularity } from "@/types";
import { useMarketFilter } from "@/hooks/useMarketFilter";
import {
  dateRangeParams,
  defaultAnalyticsRange,
  formatRatio,
  formatUsdcCompact,
} from "@/lib/platform-analytics";

/**
 * Payouts for one market. Every amount here is USDC — payouts settle on-chain in USDC whatever the
 * market's premium currency — so the market selects WHICH payouts, never the unit they are shown
 * in. The old page formatted these as KES.
 */
export default function PayoutsAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultAnalyticsRange);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const marketFilter = useMarketFilter("single");
  const { countryCode } = marketFilter;
  const range = dateRangeParams(dateRange);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["payoutsAnalytics", countryCode, range.startDate, range.endDate, granularity],
    queryFn: () => api.getPayoutsAnalytics({ countryCode, granularity, ...range }),
  });

  return (
    <div className="space-y-6">
      <AnalyticsHeader
        title="Payouts Analytics"
        description={`Payout performance in ${marketFilter.market?.countryName ?? "the selected market"} — amounts in USDC`}
        mode="single"
        marketFilter={marketFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        granularity={granularity}
        onGranularityChange={setGranularity}
      />

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            We couldn't load payout analytics. Please try again.
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Paid (USDC)"
          value={isLoading ? "—" : formatUsdcCompact(data?.totalUsdc ?? 0)}
          icon={DollarSign}
        />
        <StatCard
          title="Average Payout (USDC)"
          value={isLoading ? "—" : formatUsdcCompact(data?.avgUsdc ?? 0)}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Payouts"
          value={isLoading ? "—" : (data?.count ?? 0).toLocaleString()}
          icon={Hash}
        />
        <StatCard
          title="Success Rate"
          value={isLoading ? "—" : formatRatio(data?.successRate ?? 0)}
          icon={CheckCircle}
        />
      </div>

      {/* Charts */}
      <AreaChart
        data={data?.timeSeries ?? []}
        xKey="date"
        yKeys={[{ key: "amountUsdc", name: "Amount (USDC)", color: "hsl(var(--chart-1))" }]}
        title="Payouts Over Time (USDC)"
        formatYAxis={(v) => formatUsdcCompact(v)}
        height={300}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <PieChart data={data?.byStatus ?? []} title="Payouts by Status" height={280} />
        <SettlementBreakdownCard breakdown={data?.byDeterminationStatus} />
      </div>
    </div>
  );
}
