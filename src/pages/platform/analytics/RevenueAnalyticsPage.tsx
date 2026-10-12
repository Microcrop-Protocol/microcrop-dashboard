import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { AnalyticsHeader } from "@/components/platform/AnalyticsHeader";
import { UnconfirmedCurrencyNotice } from "@/components/platform/UnconfirmedCurrencyNotice";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Wallet, ArrowDownUp, Percent } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Granularity } from "@/types";
import { useMarketFilter } from "@/hooks/useMarketFilter";
import { formatMoneyCompact, withCurrencySuffix } from "@/lib/market";
import {
  confirmedMarket,
  dateRangeParams,
  defaultAnalyticsRange,
  formatRatio,
  formatUsdcCompact,
} from "@/lib/platform-analytics";

/**
 * Revenue for ONE market at a time. Premiums and fees are local money, so "All markets" is not
 * offered: adding KES to GHS produces a number with no unit. Payouts are USDC and are shown beside
 * the local figures, never netted against them — there is deliberately no "net revenue" tile.
 */
export default function RevenueAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultAnalyticsRange);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const marketFilter = useMarketFilter("single");
  const { countryCode } = marketFilter;
  const range = dateRangeParams(dateRange);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["revenueAnalytics", countryCode, range.startDate, range.endDate, granularity],
    queryFn: () => api.getRevenueAnalytics({ countryCode, granularity, ...range }),
  });

  // Labelled only when the server confirms the figures are for the market asked for.
  const market = data ? confirmedMarket(data, countryCode) : null;
  const money = (v: number) => (isLoading ? "—" : formatMoneyCompact(v, market));

  return (
    <div className="space-y-6">
      <AnalyticsHeader
        title="Revenue Analytics"
        description={`Premiums and platform fees in ${marketFilter.market?.countryName ?? "the selected market"}`}
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
            We couldn't load revenue analytics. Please try again.
          </CardContent>
        </Card>
      )}
      {data && !market && marketFilter.market && (
        <UnconfirmedCurrencyNotice requested={marketFilter.market.countryName} />
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={withCurrencySuffix("Total Premiums", market)}
          value={money(data?.totals.premiums ?? 0)}
          icon={Wallet}
        />
        <StatCard
          title={withCurrencySuffix("Platform Fees", market)}
          value={money(data?.totals.fees ?? 0)}
          icon={DollarSign}
        />
        <StatCard
          title="Payouts (USDC)"
          value={isLoading ? "—" : formatUsdcCompact(data?.totals.payoutsUsdc ?? 0)}
          subtitle="Settled on-chain in USDC"
          icon={ArrowDownUp}
        />
        <StatCard
          title="Loss Ratio"
          value={isLoading ? "—" : formatRatio(data?.totals.lossRatio ?? null)}
          subtitle={
            data && data.totals.lossRatio === null
              ? "Needs USDC-denominated premiums"
              : "USDC payouts ÷ USDC premiums"
          }
          icon={Percent}
        />
      </div>

      {/* Local money only — USDC payouts would need a second axis and a second unit. */}
      <AreaChart
        data={data?.timeSeries ?? []}
        xKey="date"
        yKeys={[
          { key: "premiums", name: withCurrencySuffix("Premiums", market), color: "hsl(var(--chart-1))" },
          { key: "fees", name: withCurrencySuffix("Fees", market), color: "hsl(var(--chart-3))" },
        ]}
        title="Premiums and Fees Over Time"
        formatYAxis={(v) => formatMoneyCompact(v, market)}
        height={350}
      />

      <BarChart
        data={(data?.byOrganization ?? []).map((org) => ({ name: org.name, value: org.fees }))}
        xKey="name"
        title={withCurrencySuffix("Platform Fees by Organization", market)}
        formatYAxis={(v) => formatMoneyCompact(v, market)}
        horizontal
        height={300}
      />
    </div>
  );
}
