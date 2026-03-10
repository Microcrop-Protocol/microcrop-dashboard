import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function FarmerImportPage() {
  const { toast } = useToast();
  const [farmersJson, setFarmersJson] = useState("");
  const [plotsJson, setPlotsJson] = useState("");

  const importFarmersMutation = useMutation({
    mutationFn: (farmers: Record<string, unknown>[]) => api.bulkImportFarmers(farmers),
    onSuccess: (result) => {
      toast({ title: "Farmers imported", description: `Successfully imported ${result?.imported ?? 0} farmers.` });
      setFarmersJson("");
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const importPlotsMutation = useMutation({
    mutationFn: (plots: Record<string, unknown>[]) => api.bulkImportPlots(plots),
    onSuccess: (result) => {
      toast({ title: "Plots imported", description: `Successfully imported ${result?.imported ?? 0} plots.` });
      setPlotsJson("");
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const handleImportFarmers = () => {
    try {
      const parsed = JSON.parse(farmersJson);
      if (!Array.isArray(parsed)) {
        toast({ title: "Invalid format", description: "Input must be a JSON array.", variant: "destructive" });
        return;
      }
      importFarmersMutation.mutate(parsed);
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid JSON.", variant: "destructive" });
    }
  };

  const handleImportPlots = () => {
    try {
      const parsed = JSON.parse(plotsJson);
      if (!Array.isArray(parsed)) {
        toast({ title: "Invalid format", description: "Input must be a JSON array.", variant: "destructive" });
        return;
      }
      importPlotsMutation.mutate(parsed);
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid JSON.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground">Import farmers and plots via JSON or CSV</p>
      </div>
      <Tabs defaultValue="farmers">
        <TabsList><TabsTrigger value="farmers">Import Farmers</TabsTrigger><TabsTrigger value="plots">Import Plots</TabsTrigger></TabsList>
        <TabsContent value="farmers">
          <Card>
            <CardHeader><CardTitle className="text-base">Import Farmers (Max 500)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder='[{"firstName": "John", "lastName": "Doe", "phone": "+254712345678", "nationalId": "12345678", "county": "Nakuru"}]'
                rows={10}
                value={farmersJson}
                onChange={(e) => setFarmersJson(e.target.value)}
              />
              <Button onClick={handleImportFarmers} disabled={!farmersJson.trim() || importFarmersMutation.isPending}>
                {importFarmersMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import Farmers
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="plots">
          <Card>
            <CardHeader><CardTitle className="text-base">Import Plots (Max 500)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder='[{"farmerPhone": "+254712345678", "name": "Plot A", "latitude": -0.3031, "longitude": 36.08, "acreage": 2.5, "cropType": "Maize"}]'
                rows={10}
                value={plotsJson}
                onChange={(e) => setPlotsJson(e.target.value)}
              />
              <Button onClick={handleImportPlots} disabled={!plotsJson.trim() || importPlotsMutation.isPending}>
                {importPlotsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import Plots
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
