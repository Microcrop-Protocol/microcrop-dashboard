import { useQuery } from "@tanstack/react-query";
import { mockApi, mockLiquidityPool } from "@/lib/mockData";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, DollarSign, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PoolPage() {
  const { data: pool } = useQuery({ queryKey: ["pool"], queryFn: () => mockApi.getLiquidityPool() });
  const p = pool ?? mockLiquidityPool;
  const formatCurrency = (v: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div><h1 className="text-2xl font-bold">Liquidity Pool</h1><p className="text-muted-foreground">Manage your insurance pool</p></div>
        <Button variant="outline" asChild><a href={`https://basescan.org/address/${p.address}`} target="_blank" rel="noopener noreferrer">{`${p.address.slice(0,6)}...${p.address.slice(-4)}`}<ExternalLink className="ml-2 h-4 w-4" /></a></Button>
      </div>
      <Card><CardHeader><CardTitle>Pool Balance</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold text-primary">{formatCurrency(p.balance)}</p><div className="mt-4"><div className="flex justify-between text-sm mb-1"><span>Utilization Rate</span><span>{(p.utilizationRate * 100).toFixed(0)}%</span></div><Progress value={p.utilizationRate * 100} /></div></CardContent></Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Capital Deposited" value={formatCurrency(p.capitalDeposited)} icon={ArrowDownToLine} />
        <StatCard title="Premiums Received" value={formatCurrency(p.premiumsReceived)} icon={Wallet} />
        <StatCard title="Payouts Sent" value={formatCurrency(p.payoutsSent)} icon={ArrowUpFromLine} />
        <StatCard title="Fees Paid" value={formatCurrency(p.feesPaid)} icon={DollarSign} />
      </div>
      <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Available for Withdrawal</p><p className="text-2xl font-bold">{formatCurrency(p.availableForWithdrawal)}</p></CardContent></Card>
    </div>
  );
}
