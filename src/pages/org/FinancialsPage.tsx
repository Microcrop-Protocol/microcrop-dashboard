import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { Wallet, DollarSign, TrendingDown, Percent } from "lucide-react";

export default function FinancialsPage() {
  const { data } = useQuery({
    queryKey: ["financials"],
    queryFn: () => api.getFinancialSummary(),
  });
  const formatCurrency = (v: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", notation: "compact", maximumFractionDigits: 1 }).format(v);

  const chartData = [
    { date: "Jan 1", premiums: 250000, payouts: 80000 },
    { date: "Jan 8", premiums: 280000, payouts: 120000 },
    { date: "Jan 15", premiums: 200000, payouts: 50000 },
    { date: "Jan 22", premiums: 320000, payouts: 150000 },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Financials</h1><p className="text-muted-foreground">Organization financial overview</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Premiums" value={formatCurrency(data?.totalPremiums ?? 0)} icon={Wallet} />
        <StatCard title="Total Payouts" value={formatCurrency(data?.totalPayouts ?? 0)} icon={DollarSign} />
        <StatCard title="Total Fees" value={formatCurrency(data?.totalFees ?? 0)} icon={TrendingDown} />
        <StatCard title="Loss Ratio" value={`${((data?.lossRatio ?? 0) * 100).toFixed(0)}%`} icon={Percent} className={(data?.lossRatio ?? 0) > 0.8 ? "border-error" : ""} />
      </div>
      <AreaChart data={chartData} xKey="date" yKeys={[{ key: "premiums", name: "Premiums", color: "hsl(var(--chart-1))" }, { key: "payouts", name: "Payouts", color: "hsl(var(--chart-2))" }]} title="Premiums vs Payouts" formatYAxis={(v) => formatCurrency(v)} height={300} />
    </div>
  );
}
