import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { mockApi, mockPlots, mockPolicies } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { ArrowLeft, Phone, MapPin, FileText } from "lucide-react";

export default function FarmerDetailPage() {
  const { farmerId } = useParams();
  const { data: farmer } = useQuery({
    queryKey: ["farmer", farmerId],
    queryFn: () => mockApi.getFarmer(farmerId!),
  });

  if (!farmer) return <div className="p-8 text-center">Loading...</div>;

  const farmerPlots = mockPlots.filter(p => p.farmerId === farmerId);
  const farmerPolicies = mockPolicies.filter(p => p.farmerId === farmerId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link to="/org/farmers"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-bold">{farmer.firstName} {farmer.lastName}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />{farmer.phone}
            <MapPin className="h-4 w-4 ml-2" />{farmer.county}
          </div>
        </div>
        <StatusBadge variant={getStatusVariant(farmer.kycStatus)} className="ml-auto">{farmer.kycStatus}</StatusBadge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Plots ({farmerPlots.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {farmerPlots.map(plot => (
              <div key={plot.id} className="flex justify-between rounded-lg border p-3">
                <div><p className="font-medium">{plot.name}</p><p className="text-sm text-muted-foreground">{plot.cropType} • {plot.acreage} acres</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Policies ({farmerPolicies.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {farmerPolicies.map(policy => (
              <div key={policy.id} className="flex justify-between rounded-lg border p-3">
                <div><p className="font-medium">{policy.policyNumber}</p><p className="text-sm text-muted-foreground">{policy.coverageType}</p></div>
                <StatusBadge variant={getStatusVariant(policy.status)}>{policy.status}</StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
