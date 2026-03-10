import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NewPolicyPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const orgId = user?.organizationId || "";

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    farmerId: "",
    plotId: "",
    sumInsured: 100000,
    coverageType: "BOTH",
    duration: 180,
  });

  const { data: farmersData } = useQuery({
    queryKey: ["farmers", orgId],
    queryFn: () => api.getFarmers(orgId),
    enabled: !!orgId,
  });

  const { data: plotsData } = useQuery({
    queryKey: ["plots", orgId],
    queryFn: () => api.getPlots(orgId),
    enabled: !!orgId,
  });

  const farmers = farmersData?.data ?? [];
  const plots = plotsData?.data ?? [];

  const approvedFarmers = farmers.filter((f: any) => f.kycStatus === 'APPROVED');
  const farmerPlots = plots.filter((p: any) => p.farmerId === formData.farmerId);

  const premium = formData.sumInsured * 0.05;
  const fee = premium * 0.05;

  const purchaseMutation = useMutation({
    mutationFn: () =>
      api.purchasePolicy({
        farmerId: formData.farmerId,
        plotId: formData.plotId,
        sumInsured: formData.sumInsured,
        coverageType: formData.coverageType as "DROUGHT" | "FLOOD" | "BOTH",
        durationDays: formData.duration,
      }),
    onSuccess: () => {
      toast({ title: "Policy created", description: "The policy has been activated successfully." });
      navigate("/org/policies");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create policy", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Policy</h1>
        <p className="text-muted-foreground">
          Step {step} of 2: {step === 1 ? "Configure Policy" : "Confirm & Pay"}
        </p>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader><CardTitle>Policy Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Farmer</Label>
              <Select
                value={formData.farmerId}
                onValueChange={(v) => setFormData((p) => ({ ...p, farmerId: v, plotId: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
                <SelectContent>
                  {approvedFarmers.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.firstName} {f.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Plot</Label>
              <Select
                value={formData.plotId}
                onValueChange={(v) => setFormData((p) => ({ ...p, plotId: v }))}
                disabled={!formData.farmerId}
              >
                <SelectTrigger><SelectValue placeholder="Select plot" /></SelectTrigger>
                <SelectContent>
                  {farmerPlots.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sum Insured (KES)</Label>
              <Input
                type="number"
                value={formData.sumInsured}
                onChange={(e) => setFormData((p) => ({ ...p, sumInsured: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <Label>Coverage Type</Label>
              <Select
                value={formData.coverageType}
                onValueChange={(v) => setFormData((p) => ({ ...p, coverageType: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DROUGHT">Drought</SelectItem>
                  <SelectItem value="FLOOD">Flood</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Duration: {formData.duration} days</Label>
              <Slider
                value={[formData.duration]}
                onValueChange={(v) => setFormData((p) => ({ ...p, duration: v[0] }))}
                min={30}
                max={365}
                step={30}
              />
            </div>

            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between">
                <span>Premium</span>
                <span>KES {premium.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Platform Fee</span>
                <span>KES {fee.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 font-bold">
                <span>Total</span>
                <span>KES {(premium + fee).toLocaleString()}</span>
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              className="w-full"
              disabled={!formData.farmerId || !formData.plotId}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Confirm & Pay</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Pay KES {(premium + fee).toLocaleString()} via M-Pesa to complete policy activation.
            </p>
            <div className="rounded-lg border p-4">
              <p className="font-medium">M-Pesa Paybill: 123456</p>
              <p className="text-muted-foreground">Account: POLICY-NEW</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={purchaseMutation.isPending}>Back</Button>
              <Button className="flex-1" onClick={() => purchaseMutation.mutate()} disabled={purchaseMutation.isPending}>
                {purchaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
