import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mockData";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { Plot } from "@/types";

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
  const { data, isLoading } = useQuery({ queryKey: ["plots"], queryFn: () => mockApi.getPlots("org1") });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Plots</h1><p className="text-muted-foreground">View all registered farm plots</p></div>
      <Card><CardHeader><CardTitle className="text-base">Note: Map view requires Mapbox API key</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Add MAPBOX_TOKEN to secrets to enable interactive map.</p></CardContent></Card>
      <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} searchKey="name" />
    </div>
  );
}
