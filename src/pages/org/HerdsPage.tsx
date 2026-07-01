import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { Herd } from "@/types";
import { PieChart } from "@/components/charts/PieChart";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const columns: ColumnDef<Herd>[] = [
  { accessorKey: "name", header: "Herd Name" },
  { accessorKey: "farmerName", header: "Pastoralist" },
  { 
    accessorKey: "livestockType", 
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {((row.getValue("livestockType") as string | null) ?? "").toLowerCase()}
      </Badge>
    )
  },
  { 
    accessorKey: "headCount", 
    header: "Head Count",
    cell: ({ row }) => row.getValue("headCount")?.toLocaleString()
  },
  { 
    accessorKey: "tluCount", 
    header: "TLU",
    cell: ({ row }) => {
      const v = row.getValue("tluCount");
      return v != null ? Number(v).toFixed(2) : "-";
    }
  },
  { 
    accessorKey: "estimatedValue", 
    header: "Value (KES)",
    cell: ({ row }) => {
      const headCount = row.getValue("headCount") as number;
      const valuePerHead = Number(row.getValue("estimatedValue"));
      return (headCount * valuePerHead).toLocaleString();
    }
  },
  { 
    accessorKey: "policiesCount", 
    header: "Policies" 
  },
  {
    accessorKey: "createdAt",
    header: "Registered",
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
];

export default function HerdsPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId || "";

  const { data, isLoading } = useQuery({
    queryKey: ["herds", orgId],
    queryFn: () => api.getHerds(),
    enabled: !!orgId,
  });

  const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const nested = record.data ?? record.items ?? record.results;
      if (Array.isArray(nested)) return nested as T[];
    }
    return [];
  };

  const herds = toArray<Herd>(data?.data);

  // Calculate livestock distribution
  const livestockDistribution = herds.reduce((acc, herd) => {
    const type = herd.livestockType;
    const existing = acc.find(c => c.name === type);
    if (existing) {
      existing.value += herd.headCount;
      existing.count = (existing.count || 0) + 1;
    } else {
      acc.push({ name: type, value: herd.headCount, count: 1 });
    }
    return acc;
  }, [] as { name: string; value: number; count?: number }[]);

  // Calculate TLU distribution
  const tluDistribution = herds.reduce((acc, herd) => {
    const type = herd.livestockType;
    const existing = acc.find(c => c.name === type);
    if (existing) {
      existing.value += Number(herd.tluCount);
      existing.count = (existing.count || 0) + 1;
    } else {
      acc.push({ name: type, value: Number(herd.tluCount), count: 1 });
    }
    return acc;
  }, [] as { name: string; value: number; count?: number }[]);

  const totalTlu = herds.reduce((sum, h) => sum + Number(h.tluCount), 0);
  const totalValue = herds.reduce((sum, h) => sum + (h.headCount * Number(h.estimatedValue)), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Herds</h1>
        <p className="text-muted-foreground">View all registered herds and livestock distributions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Herds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{herds.length.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Animals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {herds.reduce((sum, h) => sum + h.headCount, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total TLU</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTlu.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Head count Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Head Count Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart 
              data={livestockDistribution} 
              height={200}
              colors={['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe']}
            />
            <div className="mt-4 space-y-2">
              {livestockDistribution.map((livestock) => (
                <div key={livestock.name} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{(livestock.name ?? "").toLowerCase()}</span>
                  <span className="font-medium">{livestock.count} herds • {livestock.value.toLocaleString()} heads</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* TLU Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">TLU Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart 
              data={tluDistribution} 
              height={200}
              colors={['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7']}
            />
            <div className="mt-4 space-y-2">
              {tluDistribution.map((livestock) => (
                <div key={livestock.name} className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{(livestock.name ?? "").toLowerCase()}</span>
                  <span className="font-medium">{livestock.value.toFixed(2)} TLU</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Herds</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={herds} 
            isLoading={isLoading} 
            searchKey="name"
          />
        </CardContent>
      </Card>
    </div>
  );
}
