import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { InsuranceUnit } from "@/types";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { CreateInsuranceUnitDialog } from "@/components/platform/CreateInsuranceUnitDialog";
import { useToast } from "@/hooks/use-toast";

const columns: ColumnDef<InsuranceUnit>[] = [
  {
    accessorKey: "country",
    header: "Country",
  },
  {
    accessorKey: "county",
    header: "Region",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue("county")}</div>
        {row.original.subCounty && (
          <div className="text-sm text-muted-foreground">{row.original.subCounty}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "unitCode",
    header: "Unit Code",
  },
  {
    header: "LRLD Season",
    cell: ({ row }) => (
      <div className="text-sm">
        {/* NDVI baselines & rates are Prisma Decimals — they arrive as strings over JSON. */}
        <div>Base: {Number(row.original.ndviBaselineLRLD).toFixed(3)}</div>
        <div className="text-muted-foreground">Rate: {Number(row.original.premiumRateLRLD).toLocaleString()}</div>
      </div>
    ),
  },
  {
    header: "SRSD Season",
    cell: ({ row }) => (
      <div className="text-sm">
        <div>Base: {Number(row.original.ndviBaselineSRSD).toFixed(3)}</div>
        <div className="text-muted-foreground">Rate: {Number(row.original.premiumRateSRSD).toLocaleString()}</div>
      </div>
    ),
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge variant={row.getValue("isActive") ? "active" : "expired"}>
        {row.getValue("isActive") ? "Active" : "Inactive"}
      </StatusBadge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
];

export default function InsuranceUnitsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["insurance-units"],
    queryFn: () => api.getInsuranceUnits(),
  });

  const createMutation = useMutation({
    // The dialog assembles bbox from four labeled coordinate inputs into the
    // [minLon, minLat, maxLon, maxLat] array the API expects (or omits it).
    mutationFn: (data: Parameters<typeof api.createInsuranceUnit>[0]) => {
      return api.createInsuranceUnit(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance-units"] });
      toast({ title: "Insurance Unit Created", description: "Successfully created the new coverage region." });
    },
    onError: (err: Error) => {
      toast({ title: "Creation Failed", description: err.message, variant: "destructive" });
    }
  });

  const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object") {
      const maybeData = (value as { data?: unknown }).data;
      if (Array.isArray(maybeData)) return maybeData as T[];
    }
    return [];
  };

  const units = toArray<InsuranceUnit>(data?.data);

  const filteredData = units.filter((unit) => {
    const matchesSearch =
      search === "" ||
      unit.county.toLowerCase().includes(search.toLowerCase()) ||
      unit.unitCode.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Insurance Units</h1>
          <p className="text-muted-foreground">
            Manage geographic regions for IBLI coverage (multi-country)
          </p>
        </div>
        <CreateInsuranceUnitDialog
          onSubmit={async (data) => {
            await createMutation.mutateAsync(data);
          }}
          isLoading={createMutation.isPending}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search regions or codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Search units"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
      />
    </div>
  );
}
