import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, FileText, DollarSign, Wallet, TrendingDown, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Policy, Payout } from "@/types";

const onboardingSteps = [
  { key: 'REGISTERED', label: 'Registered' },
  { key: 'CONFIGURED', label: 'Configured' },
  { key: 'WALLET_PROVISIONED', label: 'Wallet Provisioned' },
  { key: 'RESERVE_FUNDED', label: 'Reserve Funded' },
  { key: 'STAFF_INVITED', label: 'Staff Invited' },
  { key: 'ACTIVATED', label: 'Activated' },
];

export default function OrganizationDetailPage() {
  const { orgId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => api.getOrganization(orgId!),
    enabled: !!orgId,
  });

  // Per-org treasury (v3): provision the org's Privy wallet (its reserve key) instead of
  // deploying a pool. The org then funds its reserve from the Reserve page.
  const provisionWalletMutation = useMutation({
    mutationFn: () => api.platformProvisionWallet(orgId!),
    onSuccess: (result) => {
      toast({
        title: result.alreadyProvisioned ? "Wallet already provisioned" : "Wallet provisioned",
        description: `${result.walletAddress.slice(0, 10)}...`,
      });
      queryClient.setQueryData(["organization", orgId], (previous: unknown) => {
        if (!previous || typeof previous !== "object") return previous;
        return {
          ...(previous as Record<string, unknown>),
          walletAddress: result.walletAddress,
          onboardingStep: "WALLET_PROVISIONED",
        };
      });
      queryClient.invalidateQueries({ queryKey: ["organization", orgId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to provision wallet", description: error.message, variant: "destructive" });
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["organizationStats", orgId],
    queryFn: () => api.getOrganizationStats(orgId!),
    enabled: !!orgId,
  });

  const { data: policiesData } = useQuery({
    queryKey: ["orgPolicies", orgId],
    queryFn: () => api.getPolicies(orgId!),
    enabled: !!orgId,
  });

  const { data: payoutsData } = useQuery({
    queryKey: ["orgPayouts", orgId],
    queryFn: () => api.getPayouts(orgId!),
    enabled: !!orgId,
  });

  const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object') {
      const maybeData = (value as { data?: unknown }).data;
      if (Array.isArray(maybeData)) return maybeData as T[];
    }
    return [];
  };

  const policies = toArray<Policy>(policiesData?.data);
  const payouts = toArray<Payout>(payoutsData?.data);

  const recentPolicies = policies.slice(0, 5);
  const recentPayouts = payouts.slice(0, 5);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const currentStepIndex = onboardingSteps.findIndex(s => s.key === org?.onboardingStep);

  // Derive chart data from API responses
  const policyStatusData = (() => {
    const counts: Record<string, number> = {};
    for (const p of policies) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const coverageTypeData = (() => {
    const counts: Record<string, number> = {};
    for (const p of policies) {
      const type = p.coverageType || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const payoutStatusData = (() => {
    const counts: Record<string, number> = {};
    for (const p of payouts) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  if (orgLoading) {
    return <div className="flex items-center justify-center p-8">Loading\u2026</div>;
  }

  if (!org) {
    return <div className="flex items-center justify-center p-8">Organization not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <Button variant="ghost" size="icon" asChild className="shrink-0" aria-label="Back">
            <Link to="/platform/organizations">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-2xl font-bold truncate">{org.name}</h1>
              <StatusBadge variant={getStatusVariant(org.type)}>
                {org.type.charAt(0) + org.type.slice(1).toLowerCase()}
              </StatusBadge>
              <StatusBadge variant={org.isActive ? "active" : "expired"}>
                {org.isActive ? "Active" : "Inactive"}
              </StatusBadge>
            </div>
            <p className="text-muted-foreground">
              Created {formatDate(org.createdAt, "MMMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!org.walletAddress ? (
            <Button onClick={() => provisionWalletMutation.mutate()} disabled={provisionWalletMutation.isPending}>
              {provisionWalletMutation.isPending ? "Provisioning…" : "Provision Wallet"}
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <a
                href={`https://basescan.org/address/${org.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Wallet
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          )}
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
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {onboardingSteps.map((step, index) => (
              <div key={step.key} className="flex min-w-0 flex-1 items-center">
                <div className="flex flex-col items-center">
                  {index <= currentStepIndex ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success sm:h-6 sm:w-6" aria-hidden="true" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground sm:h-6 sm:w-6" aria-hidden="true" />
                  )}
                  <span className="mt-1 max-w-[60px] truncate text-center text-[10px] text-muted-foreground sm:mt-2 sm:max-w-none sm:text-xs">{step.label}</span>
                </div>
                {index < onboardingSteps.length - 1 && (
                  <div className={`mx-1 h-0.5 flex-1 sm:mx-2 ${index < currentStepIndex ? "bg-success" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              {recentPolicies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent policies</p>
              ) : (
                recentPolicies.map((policy) => (
                  <div key={policy.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{policy.policyNumber}</p>
                      <p className="text-sm text-muted-foreground">{policy.farmerName}</p>
                    </div>
                    <StatusBadge variant={getStatusVariant(policy.status)}>
                      {policy.status}
                    </StatusBadge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPayouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent payouts</p>
              ) : (
                recentPayouts.map((payout) => (
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
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
