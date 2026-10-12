import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { AnalyticsHeader } from "@/components/platform/AnalyticsHeader";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Granularity } from "@/types";
import { useMarketFilter } from "@/hooks/useMarketFilter";
import { dateRangeParams, defaultAnalyticsRange, formatRatio } from "@/lib/platform-analytics";

/** Policy counts carry no currency, so "All markets" is meaningful here. */
export default function PoliciesAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultAnalyticsRange);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const marketFilter = useMarketFilter("any");
  const { countryCode } = marketFilter;
  const range = dateRangeParams(dateRange);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["policiesAnalytics", countryCode ?? "ALL", range.startDate, range.endDate, granularity],
    queryFn: () => api.getPoliciesAnalytics({ countryCode, granularity, ...range }),
  });

  const count = (v: number | undefined) => (isLoading ? "—" : (v ?? 0).toLocaleString());

  return (
    <div className="space-y-6">
      <AnalyticsHeader
        title="Policies Analytics"
        description={`Policy creation and status trends — ${marketFilter.market?.countryName ?? "all markets"}`}
        mode="any"
        marketFilter={marketFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        granularity={granularity}
        onGranularityChange={setGranularity}
      />

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            We couldn't load policy analytics. Please try again.
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Policies" value={count(data?.totalPolicies)} icon={FileText} />
        <StatCard title="Active Policies" value={count(data?.activePolicies)} icon={CheckCircle} />
        <StatCard
          title="Claims Ratio"
          value={isLoading ? "—" : formatRatio(data?.claimsRatio ?? 0)}
          subtitle="Claimed ÷ (active + expired + claimed)"
          icon={AlertTriangle}
        />
        <StatCard
          title="New This Period"
          value={count(data?.newInPeriod)}
          subtitle="In selected period"
          icon={TrendingUp}
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
