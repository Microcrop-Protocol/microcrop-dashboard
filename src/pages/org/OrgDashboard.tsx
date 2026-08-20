import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, DollarSign, Wallet, TrendingUp, ShieldAlert, Clock, ArrowRight } from "lucide-react";
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

  const { data: kyb } = useQuery({
    queryKey: ["my-kyb"],
    queryFn: () => api.getMyKyb(),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Organization overview and key metrics</p>
        </div>
      </div>

      {kyb && kyb.kybStatus !== "VERIFIED" && (
        <Card className={kyb.kybStatus === "REJECTED" ? "border-destructive" : "border-warning/40"}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {kyb.kybStatus === "PENDING_REVIEW" ? (
                <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
              ) : (
                <ShieldAlert className="mt-0.5 h-5 w-5 text-warning" />
              )}
              <div className="text-sm">
                <p className="font-medium">
                  {kyb.kybStatus === "PENDING_REVIEW"
                    ? "KYB under review"
                    : kyb.kybStatus === "REJECTED"
                      ? "KYB needs changes"
                      : "Complete your verification"}
                </p>
                <p className="text-muted-foreground">
                  {kyb.kybStatus === "PENDING_REVIEW"
                    ? "We'll email you once your documents are reviewed. Policy creation and reserve funding unlock after approval."
                    : "Submit your KYB documents to unlock policy creation and reserve funding."}
                </p>
              </div>
            </div>
            {kyb.kybStatus !== "PENDING_REVIEW" && (
              <Button asChild className="shrink-0">
                <Link to="/org/kyb">
                  Complete KYB
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

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
