import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function PolicyDetailPage() {
  const { policyId } = useParams();
  const { user } = useAuthStore();
  const orgId = user?.organizationId || "";

  const { data: policy, isLoading: policyLoading } = useQuery({
    queryKey: ["policy", policyId],
    queryFn: () => api.getPolicy(policyId!),
    enabled: !!policyId,
  });

  const { data: payoutsData } = useQuery({
    queryKey: ["payouts", orgId],
    queryFn: () => api.getPayouts(orgId),
    enabled: !!orgId,
  });

  const { data: damageData } = useQuery({
    queryKey: ["damage"],
    queryFn: () => api.getDamageAssessments(),
  });

  if (policyLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!policy) return <div className="p-8 text-center">Policy not found</div>;

  const policyPayouts = payoutsData?.data?.filter((p: any) => p.policyId === policyId) ?? [];
  const policyDamage = damageData?.data?.filter((d: any) => d.policyId === policyId) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/org/policies"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{policy.policyNumber}</h1>
          <p className="text-muted-foreground">{policy.farmerName} • {policy.plotName}</p>
        </div>
        <StatusBadge variant={getStatusVariant(policy.status)}>{policy.status}</StatusBadge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sum Insured</p>
            <p className="text-2xl font-bold">KES {policy.sumInsured?.toLocaleString() ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Coverage</p>
            <p className="text-2xl font-bold">{policy.coverageType}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Expires</p>
            <p className="text-2xl font-bold">
              {formatDate(policy.endDate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Damage Assessments</CardTitle></CardHeader>
          <CardContent>
            {policyDamage.length === 0 ? (
              <p className="text-muted-foreground">No assessments yet</p>
            ) : (
              policyDamage.map((d: any) => (
                <div key={d.id} className="border-b py-2 last:border-0">
                  <p>Combined: {(d.combinedDamageScore * 100).toFixed(0)}%</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Payouts</CardTitle></CardHeader>
          <CardContent>
            {policyPayouts.length === 0 ? (
              <p className="text-muted-foreground">No payouts yet</p>
            ) : (
              policyPayouts.map((p: any) => (
                <div key={p.id} className="flex justify-between border-b py-2 last:border-0">
                  <span>KES {p.amount?.toLocaleString() ?? 0}</span>
                  <StatusBadge variant={getStatusVariant(p.status)}>{p.status}</StatusBadge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
