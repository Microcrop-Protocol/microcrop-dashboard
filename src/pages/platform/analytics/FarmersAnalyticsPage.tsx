import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { AnalyticsHeader } from "@/components/platform/AnalyticsHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserPlus, FileCheck, MapPin } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Granularity } from "@/types";
import { useMarketFilter } from "@/hooks/useMarketFilter";
import { divisionLabelForFilter, pluralDivisionLabel } from "@/lib/market-filter";
import {
  countyChartData,
  dateRangeParams,
  defaultAnalyticsRange,
  formatRatio,
  kycApprovalRate,
} from "@/lib/platform-analytics";

/**
 * Farmer registrations and where farmers are. The `county` column holds a Kenyan County or a
 * Ghanaian Region, so the label follows the selected market, and across markets each area is
 * tagged with its country — the backend returns `byCounty` as `[{ countryCode, county, count }]`
 * precisely so two markets' areas are never merged under one name.
 */
export default function FarmersAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultAnalyticsRange);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const marketFilter = useMarketFilter("any");
  const { countryCode } = marketFilter;
  const range = dateRangeParams(dateRange);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["farmersAnalytics", countryCode ?? "ALL", range.startDate, range.endDate, granularity],
    queryFn: () => api.getFarmersAnalytics({ countryCode, granularity, ...range }),
  });

  const division = divisionLabelForFilter(marketFilter.value);
  const byCounty = data?.byCounty ?? [];
  const count = (v: number | undefined) => (isLoading ? "—" : (v ?? 0).toLocaleString());

  return (
    <div className="space-y-6">
      <AnalyticsHeader
        title="Farmers Analytics"
        description={`Farmer registrations and KYC status — ${marketFilter.market?.countryName ?? "all markets"}`}
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
            We couldn't load farmer analytics. Please try again.
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Farmers" value={count(data?.totalFarmers)} icon={Users} />
        <StatCard title="New This Period" value={count(data?.newInPeriod)} icon={UserPlus} />
        <StatCard
          title="KYC Approved"
          value={isLoading || !data ? "—" : formatRatio(kycApprovalRate(data), 0)}
          icon={FileCheck}
        />
        <StatCard
          title={`${pluralDivisionLabel(division)} Covered`}
          value={isLoading ? "—" : byCounty.length}
          icon={MapPin}
        />
      </div>

      {/* Charts */}
      <LineChart
        data={data?.timeSeries ?? []}
        xKey="date"
        yKeys={[{ key: "value", name: "Farmers Registered", color: "hsl(var(--chart-1))" }]}
        title="Farmer Registrations Over Time"
        height={300}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <PieChart data={data?.byKycStatus ?? []} title="Farmers by KYC Status" height={280} />
        <BarChart
          data={countyChartData(byCounty, { withMarket: !countryCode })}
          xKey="name"
          title={`Farmers by ${division}`}
          horizontal
          height={280}
        />
      </div>
    </div>
  );
}
