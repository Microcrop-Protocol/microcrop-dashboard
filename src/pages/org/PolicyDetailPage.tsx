import { useParams, Link } from "react-router-dom";
import { mockPolicies, mockPayouts, mockDamageAssessments } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export default function PolicyDetailPage() {
  const { policyId } = useParams();
  const policy = mockPolicies.find(p => p.id === policyId);
  if (!policy) return <div className="p-8 text-center">Policy not found</div>;

  const policyPayouts = mockPayouts.filter(p => p.policyId === policyId);
  const policyDamage = mockDamageAssessments.filter(d => d.policyId === policyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link to="/org/policies"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{policy.policyNumber}</h1>
          <p className="text-muted-foreground">{policy.farmerName} • {policy.plotName}</p>
        </div>
        <StatusBadge variant={getStatusVariant(policy.status)}>{policy.status}</StatusBadge>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Sum Insured</p><p className="text-2xl font-bold">KES {policy.sumInsured.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Coverage</p><p className="text-2xl font-bold">{policy.coverageType}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Expires</p><p className="text-2xl font-bold">{format(new Date(policy.endDate), "MMM d, yyyy")}</p></CardContent></Card>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Damage Assessments</CardTitle></CardHeader><CardContent>{policyDamage.length === 0 ? <p className="text-muted-foreground">No assessments yet</p> : policyDamage.map(d => <div key={d.id} className="border-b py-2 last:border-0"><p>Combined: {(d.combinedDamageScore*100).toFixed(0)}%</p></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Payouts</CardTitle></CardHeader><CardContent>{policyPayouts.length === 0 ? <p className="text-muted-foreground">No payouts yet</p> : policyPayouts.map(p => <div key={p.id} className="flex justify-between border-b py-2 last:border-0"><span>KES {p.amount.toLocaleString()}</span><StatusBadge variant={getStatusVariant(p.status)}>{p.status}</StatusBadge></div>)}</CardContent></Card>
      </div>
    </div>
  );
}
