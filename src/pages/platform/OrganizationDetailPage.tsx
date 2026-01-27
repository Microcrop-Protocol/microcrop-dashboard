import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { mockApi, mockPolicies, mockPayouts } from "@/lib/mockData";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, FileText, DollarSign, Wallet, TrendingDown, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";

const onboardingSteps = [
  { key: 'REGISTERED', label: 'Registered' },
  { key: 'CONFIGURED', label: 'Configured' },
  { key: 'POOL_DEPLOYED', label: 'Pool Deployed' },
  { key: 'FUNDED', label: 'Funded' },
  { key: 'STAFF_INVITED', label: 'Staff Invited' },
  { key: 'ACTIVATED', label: 'Activated' },
];

export default function OrganizationDetailPage() {
  const { orgId } = useParams();

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => mockApi.getOrganization(orgId!),
  });

  const { data: stats } = useQuery({
    queryKey: ["organizationStats", orgId],
    queryFn: () => mockApi.getOrganizationStats(orgId!),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const currentStepIndex = onboardingSteps.findIndex(s => s.key === org?.onboardingStep);

  // Mock data for charts
  const kycStatusData = [
    { name: 'Approved', value: 1850 },
    { name: 'Pending', value: 120 },
    { name: 'Rejected', value: 30 },
  ];

  const policyStatusData = [
    { name: 'Active', value: 750 },
    { name: 'Expired', value: 98 },
    { name: 'Claimed', value: 32 },
    { name: 'Cancelled', value: 10 },
  ];

  const coverageTypeData = [
    { name: 'Drought', value: 420 },
    { name: 'Flood', value: 180 },
    { name: 'Both', value: 290 },
  ];

  const payoutStatusData = [
    { name: 'Completed', value: 145 },
    { name: 'Pending', value: 8 },
    { name: 'Failed', value: 3 },
  ];

  if (orgLoading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  if (!org) {
    return <div className="flex items-center justify-center p-8">Organization not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/platform/organizations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{org.name}</h1>
              <StatusBadge variant={getStatusVariant(org.type)}>
                {org.type.charAt(0) + org.type.slice(1).toLowerCase()}
              </StatusBadge>
              <StatusBadge variant={org.isActive ? "active" : "expired"}>
                {org.isActive ? "Active" : "Inactive"}
              </StatusBadge>
            </div>
            <p className="text-muted-foreground">
              Created {format(new Date(org.createdAt), "MMMM d, yyyy")}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Farmers" value={stats?.totalFarmers?.toLocaleString() ?? 0} icon={Users} />
        <StatCard title="Active Policies" value={stats?.activePolicies?.toLocaleString() ?? 0} icon={FileText} />
        <StatCard title="Premiums" value={formatCurrency(stats?.totalPremiums ?? 0)} icon={Wallet} />
        <StatCard title="Payouts" value={formatCurrency(stats?.totalPayouts ?? 0)} icon={DollarSign} />
        <StatCard title="Fees" value={formatCurrency(stats?.totalFees ?? 0)} icon={TrendingDown} />
        <StatCard 
          title="Loss Ratio" 
          value={`${((stats?.lossRatio ?? 0) * 100).toFixed(0)}%`}
          className={stats?.lossRatio && stats.lossRatio > 0.8 ? "border-error" : ""}
        />
      </div>

      {/* Onboarding Stepper */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Onboarding Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {onboardingSteps.map((step, index) => (
              <div key={step.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  {index <= currentStepIndex ? (
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                  <span className="mt-2 text-xs text-muted-foreground">{step.label}</span>
                </div>
                {index < onboardingSteps.length - 1 && (
                  <div className={`mx-2 h-0.5 flex-1 ${index < currentStepIndex ? "bg-success" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <PieChart data={kycStatusData} title="Farmers by KYC Status" height={250} />
        <PieChart data={policyStatusData} title="Policies by Status" height={250} />
        <BarChart data={coverageTypeData} xKey="name" title="Policies by Coverage Type" height={250} />
        <BarChart data={payoutStatusData} xKey="name" title="Payouts by Status" height={250} />
      </div>

      {/* Recent Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockPolicies.slice(0, 5).map((policy) => (
                <div key={policy.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{policy.policyNumber}</p>
                    <p className="text-sm text-muted-foreground">{policy.farmerName}</p>
                  </div>
                  <StatusBadge variant={getStatusVariant(policy.status)}>
                    {policy.status}
                  </StatusBadge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockPayouts.slice(0, 5).map((payout) => (
                <div key={payout.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{payout.policyNumber}</p>
                    <p className="text-sm text-muted-foreground">{payout.farmerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">KES {payout.amount.toLocaleString()}</p>
                    <StatusBadge variant={getStatusVariant(payout.status)}>
                      {payout.status}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
