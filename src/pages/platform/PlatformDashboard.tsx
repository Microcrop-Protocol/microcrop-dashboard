import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketSelect } from "@/components/platform/MarketSelect";
import { Building2, Users, FileText, DollarSign } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { useMarketFilter } from "@/hooks/useMarketFilter";
import { formatMoneyCompact, marketOrNull } from "@/lib/market";
import { confirmedMarket, dateRangeParams, formatUsdcCompact } from "@/lib/platform-analytics";
import { isBaseSettlementEnabled } from "@/lib/explorer";
import type { PlatformCurrencyFinancials } from "@/types";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

/** A local-money figure, or "—" when the server sent none — never a confident 0. */
const formatLocal = (value: number | null, market: ReturnType<typeof confirmedMarket>) =>
  value === null ? "—" : formatMoneyCompact(value, market);

/**
 * One market's premiums and fees, in that market's currency. Each card is labelled from its own
 * row — never from the page's filter — and the rows are never added together.
 */
function CurrencyFinancialsCard({ row }: { row: PlatformCurrencyFinancials }) {
  const market = confirmedMarket(row);
  const name = marketOrNull(row.countryCode)?.countryName ?? row.countryCode;
  return (
    <Card data-testid={`financials-${row.countryCode}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {name} · {row.currency}
        </CardTitle>
        <CardDescription>Premiums and platform fees, in {row.currency}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Premiums collected</p>
          <p className="text-xl font-bold tabular-nums">{formatLocal(row.totalPremiums, market)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Platform fees</p>
          <p className="text-xl font-bold tabular-nums">{formatLocal(row.totalFees, market)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlatformDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const { value: marketFilter, setValue: setMarketFilter, countryCode, market } = useMarketFilter("any");
  const range = dateRangeParams(dateRange);

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["platformStats", countryCode ?? "ALL", range.startDate, range.endDate],
    queryFn: () => api.getPlatformStats({ countryCode, ...range }),
  });

  const { data: activities } = useQuery({
    queryKey: ["platformActivities"],
    queryFn: () => api.getActivities(),
  });

  // With one market selected only that market's row belongs on the page, even if the server
  // returned more — a GHS card under a "Kenya" filter would read as Kenyan money.
  const byCurrency = (stats?.financials.byCurrency ?? []).filter(
    (row) => !countryCode || row.countryCode.toUpperCase() === countryCode,
  );
  const scope = market ? market.countryName : "all markets";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of organizations and platform metrics — {scope}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MarketSelect mode="any" value={marketFilter} onChange={setMarketFilter} />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {isError && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            We couldn't load platform metrics. Please try again.
          </CardContent>
        </Card>
      )}

      {/* KPI Cards — counts, and payouts in USDC (the one currency payouts settle in). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Organizations"
          value={isLoading ? "—" : formatNumber(stats?.organizations.total ?? 0)}
          subtitle={`${stats?.organizations.active ?? 0} active`}
          icon={Building2}
        />
        <StatCard
          title="Total Farmers"
          value={isLoading ? "—" : formatNumber(stats?.farmers.total ?? 0)}
          icon={Users}
        />
        <StatCard
          title="Active Policies"
          value={isLoading ? "—" : formatNumber(stats?.policies.active ?? 0)}
          subtitle={`+${stats?.policies.periodNew ?? 0} this period`}
          icon={FileText}
        />
        <StatCard
          // Every USDC payout is a legacy Base settlement. With Base retired MicroCrop moves no
          // money, so the tile says it is history rather than a running "sent" figure.
          title={isBaseSettlementEnabled() ? "Payouts Sent (USDC)" : "Legacy (Base) payouts (USDC)"}
          value={isLoading ? "—" : formatUsdcCompact(stats?.financials.totalPayoutsUsdc)}
          subtitle={`${stats?.financials.totalPayoutCount ?? 0} payouts · ${isBaseSettlementEnabled() ? "settled in USDC" : "settled on Base before it was retired"}`}
          icon={DollarSign}
        />
      </div>

      {/* Money in local currency, one card per market. */}
      <section aria-labelledby="financials-heading" className="space-y-3">
        <h2 id="financials-heading" className="text-base font-semibold">
          Premiums and fees by market
        </h2>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : byCurrency.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No premiums or fees recorded for {scope}.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {byCurrency.map((row) => (
              <CurrencyFinancialsCard key={`${row.countryCode}-${row.currency}`} row={row} />
            ))}
          </div>
        )}
      </section>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>Across all markets</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities?.data ?? []} maxItems={5} />
        </CardContent>
      </Card>
    </div>
  );
}
