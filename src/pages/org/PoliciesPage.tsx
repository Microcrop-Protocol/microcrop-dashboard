import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Policy } from "@/types";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

const columns: ColumnDef<Policy>[] = [
  { accessorKey: "policyNumber", header: "Policy #" },
  { accessorKey: "farmerName", header: "Farmer" },
  { accessorKey: "plotName", header: "Plot" },
  { accessorKey: "coverageType", header: "Coverage" },
  { accessorKey: "cropType", header: "Crop" },
  { accessorKey: "sumInsured", header: "Sum Insured", cell: ({ row }) => `KES ${(row.getValue("sumInsured") as number).toLocaleString()}` },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge variant={getStatusVariant(row.getValue("status"))}>{row.getValue("status")}</StatusBadge> },
  { accessorKey: "endDate", header: "Expires", cell: ({ row }) => formatDate(row.getValue("endDate")) },
];

export default function PoliciesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const orgId = user?.organizationId || "";

  const { data, isLoading } = useQuery({
    queryKey: ["policies", orgId],
    queryFn: () => api.getPolicies(orgId),
    enabled: !!orgId,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div><h1 className="text-2xl font-bold">Policies</h1><p className="text-muted-foreground">Manage crop insurance policies</p></div>
        <Button asChild><Link to="/org/policies/new"><Plus className="mr-2 h-4 w-4" />New Policy</Link></Button>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} searchKey="policyNumber" onRowClick={(row) => navigate(`/org/policies/${row.id}`)} />
    </div>
  );
}
