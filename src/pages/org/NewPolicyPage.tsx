import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { mockFarmers, mockPlots } from "@/lib/mockData";

export default function NewPolicyPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ farmerId: "", plotId: "", sumInsured: 100000, coverageType: "BOTH", duration: 180 });
  const premium = formData.sumInsured * 0.05;
  const fee = premium * 0.05;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div><h1 className="text-2xl font-bold">New Policy</h1><p className="text-muted-foreground">Step {step} of 2: {step === 1 ? "Configure Policy" : "Confirm & Pay"}</p></div>
      {step === 1 ? (
        <Card>
          <CardHeader><CardTitle>Policy Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Farmer</Label><Select value={formData.farmerId} onValueChange={(v) => setFormData(p => ({...p, farmerId: v}))}><SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger><SelectContent>{mockFarmers.filter(f => f.kycStatus === 'APPROVED').map(f => <SelectItem key={f.id} value={f.id}>{f.firstName} {f.lastName}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Plot</Label><Select value={formData.plotId} onValueChange={(v) => setFormData(p => ({...p, plotId: v}))}><SelectTrigger><SelectValue placeholder="Select plot" /></SelectTrigger><SelectContent>{mockPlots.filter(p => p.farmerId === formData.farmerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Sum Insured (KES)</Label><Input type="number" value={formData.sumInsured} onChange={(e) => setFormData(p => ({...p, sumInsured: parseInt(e.target.value) || 0}))} /></div>
            <div><Label>Coverage Type</Label><Select value={formData.coverageType} onValueChange={(v) => setFormData(p => ({...p, coverageType: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DROUGHT">Drought</SelectItem><SelectItem value="FLOOD">Flood</SelectItem><SelectItem value="BOTH">Both</SelectItem></SelectContent></Select></div>
            <div><Label>Duration: {formData.duration} days</Label><Slider value={[formData.duration]} onValueChange={(v) => setFormData(p => ({...p, duration: v[0]}))} min={30} max={365} step={30} /></div>
            <div className="rounded-lg bg-muted p-4"><div className="flex justify-between"><span>Premium</span><span>KES {premium.toLocaleString()}</span></div><div className="flex justify-between text-sm text-muted-foreground"><span>Platform Fee</span><span>KES {fee.toLocaleString()}</span></div><div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total</span><span>KES {(premium + fee).toLocaleString()}</span></div></div>
            <Button onClick={() => setStep(2)} className="w-full" disabled={!formData.farmerId || !formData.plotId}>Continue</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Confirm & Pay</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Pay KES {(premium + fee).toLocaleString()} via M-Pesa to complete policy activation.</p>
            <div className="rounded-lg border p-4"><p className="font-medium">M-Pesa Paybill: 123456</p><p className="text-muted-foreground">Account: POLICY-NEW</p></div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button className="flex-1">Confirm Payment</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
