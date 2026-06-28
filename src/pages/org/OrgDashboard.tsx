import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, DollarSign, Wallet, TrendingUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrgDashboard() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId || "";

  const { data: stats } = useQuery({
    queryKey: ["orgStats"],
    queryFn: () => api.getOrgDashboardStats(),
  });

  const { data: activities } = useQuery({
    queryKey: ["orgActivities", orgId],
    queryFn: () => api.getActivities(orgId),
    enabled: !!orgId,
  });

  const { data: wallet } = useQuery({
    queryKey: ["orgWallet"],
    queryFn: () => api.getOrgWallet(),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const truncateAddress = (address: unknown) => {
    const value = typeof address === "string" ? address : String(address ?? "");
    if (!value) return "—";
    if (value.length <= 10) return value;
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Organization overview and key metrics</p>
        </div>
        {wallet?.walletAddress && (
          <Button variant="outline" asChild>
            <a href={`https://basescan.org/address/${wallet.walletAddress}`} target="_blank" rel="noopener noreferrer">
              Wallet: {truncateAddress(wallet.walletAddress)}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Farmers" value={stats?.totalFarmers?.toLocaleString() ?? 0} icon={Users} />
        <StatCard title="Active Policies" value={stats?.activePolicies?.toLocaleString() ?? 0} icon={FileText} />
        <StatCard
          title="Loss Ratio"
          value={`${(stats?.lossRatio ?? 0).toFixed(1)}%`}
          subtitle="Current period"
          icon={TrendingUp}
        />
        <StatCard title="Premiums" value={formatCurrency(stats?.totalPremiums ?? 0)} icon={Wallet} />
        <StatCard title="Payouts" value={formatCurrency(stats?.totalPayouts ?? 0)} icon={DollarSign} />
        <StatCard title="Fees" value={formatCurrency(stats?.totalFees ?? 0)} icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities?.data ?? []} maxItems={5} />
        </CardContent>
      </Card>
    </div>
  );
}
