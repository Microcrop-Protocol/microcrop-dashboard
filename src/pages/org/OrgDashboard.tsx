import { useQuery } from "@tanstack/react-query";
import { mockApi, mockActivities, mockLiquidityPool } from "@/lib/mockData";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, DollarSign, Wallet, TrendingUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrgDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["orgStats"],
    queryFn: () => mockApi.getOrganizationStats("org1"),
  });

  const { data: activities } = useQuery({
    queryKey: ["orgActivities"],
    queryFn: () => mockApi.getActivities("org1"),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Organization overview and key metrics</p>
        </div>
        <Button variant="outline" asChild>
          <a href={`https://basescan.org/address/${mockLiquidityPool.address}`} target="_blank" rel="noopener noreferrer">
            Pool: {truncateAddress(mockLiquidityPool.address)}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Farmers" value={stats?.totalFarmers?.toLocaleString() ?? 0} icon={Users} trend={{ value: 12, isPositive: true }} />
        <StatCard title="Active Policies" value={stats?.activePolicies?.toLocaleString() ?? 0} icon={FileText} trend={{ value: 8, isPositive: true }} />
        <StatCard title="New Policies" value="45" subtitle="This month" icon={TrendingUp} />
        <StatCard title="Premiums" value={formatCurrency(stats?.totalPremiums ?? 0)} icon={Wallet} />
        <StatCard title="Payouts" value={formatCurrency(stats?.totalPayouts ?? 0)} icon={DollarSign} />
        <StatCard title="Fees" value={formatCurrency(stats?.totalFees ?? 0)} icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities?.data ?? mockActivities.filter(a => a.organizationId === 'org1')} maxItems={5} />
        </CardContent>
      </Card>
    </div>
  );
}
