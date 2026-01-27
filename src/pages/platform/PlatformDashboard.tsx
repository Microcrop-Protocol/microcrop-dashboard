import { useQuery } from "@tanstack/react-query";
import { mockApi, mockActivities } from "@/lib/mockData";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Building2, 
  Users, 
  FileText, 
  DollarSign, 
  Wallet, 
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";

export default function PlatformDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["platformStats", dateRange],
    queryFn: () => mockApi.getPlatformStats(),
  });

  const { data: activities } = useQuery({
    queryKey: ["platformActivities"],
    queryFn: () => mockApi.getActivities(),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-KE", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of all organizations and platform metrics
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Alerts */}
      <Alert variant="destructive" className="border-error/50 bg-error/10">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          2 failed payouts require attention. 5 policies expiring in the next 7 days.
        </AlertDescription>
      </Alert>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Organizations"
          value={stats?.totalOrganizations ?? 0}
          subtitle={`${stats?.activeOrganizations ?? 0} active`}
          icon={Building2}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Total Farmers"
          value={formatNumber(stats?.totalFarmers ?? 0)}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Active Policies"
          value={formatNumber(stats?.activePolicies ?? 0)}
          subtitle={`+${stats?.newPoliciesPeriod ?? 0} this period`}
          icon={FileText}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          icon={TrendingUp}
          trend={{ value: 22, isPositive: true }}
        />
        <StatCard
          title="Premiums Collected"
          value={formatCurrency(stats?.premiumsCollected ?? 0)}
          icon={Wallet}
          trend={{ value: 18, isPositive: true }}
        />
        <StatCard
          title="Payouts Sent"
          value={formatCurrency(stats?.payoutsSent ?? 0)}
          icon={DollarSign}
          trend={{ value: 5, isPositive: false }}
        />
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities?.data ?? mockActivities} maxItems={5} />
        </CardContent>
      </Card>
    </div>
  );
}
