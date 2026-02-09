import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { Plot } from "@/types";
import { PlotMap } from "@/components/maps/PlotMap";
import { PieChart } from "@/components/charts/PieChart";

const columns: ColumnDef<Plot>[] = [
  { accessorKey: "name", header: "Plot Name" },
  { accessorKey: "farmerName", header: "Farmer" },
  { accessorKey: "cropType", header: "Crop" },
  { accessorKey: "acreage", header: "Acreage", cell: ({ row }) => `${row.getValue("acreage")} acres` },
  { accessorKey: "policiesCount", header: "Policies" },
  { accessorKey: "latestNdvi", header: "NDVI", cell: ({ row }) => (row.getValue("latestNdvi") as number)?.toFixed(2) ?? "-" },
  { accessorKey: "latestTemperature", header: "Temp (°C)", cell: ({ row }) => (row.getValue("latestTemperature") as number)?.toFixed(1) ?? "-" },
];

export default function PlotsPage() {
  const [selectedPlotId, setSelectedPlotId] = useState<string | undefined>();
  const { user } = useAuthStore();
  const orgId = user?.organizationId || "";

  const { data, isLoading } = useQuery({
    queryKey: ["plots", orgId],
    queryFn: () => api.getPlots(orgId),
    enabled: !!orgId,
  });

  const plots = data?.data ?? [];

  // Calculate crop distribution
  const cropDistribution = plots.reduce((acc, plot) => {
    const existing = acc.find(c => c.name === plot.cropType);
    if (existing) {
      existing.value += plot.acreage;
      existing.count = (existing.count || 0) + 1;
    } else {
      acc.push({ name: plot.cropType, value: plot.acreage, count: 1 });
    }
    return acc;
  }, [] as { name: string; value: number; count?: number }[]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plots</h1>
        <p className="text-muted-foreground">View all registered farm plots with interactive map</p>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Panel */}
        <Card className="lg:row-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plot Locations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[500px] p-4 pt-0">
              <PlotMap 
                plots={plots} 
                selectedPlotId={selectedPlotId}
                onPlotSelect={(plot) => setSelectedPlotId(plot.id)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Crop Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Crop Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart 
              data={cropDistribution} 
              height={200}
              colors={['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0']}
            />
            <div className="mt-4 space-y-2">
              {cropDistribution.map((crop, i) => (
                <div key={crop.name} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{crop.name}</span>
                  <span className="font-medium">{crop.count} plots • {crop.value.toFixed(1)} acres</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Plots</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={plots} 
            isLoading={isLoading} 
            searchKey="name"
            onRowClick={(row) => setSelectedPlotId(row.id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
