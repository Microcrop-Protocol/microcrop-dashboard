import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Farmer } from "@/types";
import { formatDate } from "@/lib/utils";
import { Plus, Upload, Download } from "lucide-react";
import { Link } from "react-router-dom";

const columns: ColumnDef<Farmer>[] = [
  { accessorKey: "firstName", header: "First Name" },
  { accessorKey: "lastName", header: "Last Name" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "nationalId", header: "National ID" },
  { accessorKey: "county", header: "County" },
  {
    accessorKey: "kycStatus",
    header: "KYC Status",
    cell: ({ row }) => (
      <StatusBadge variant={getStatusVariant(row.getValue("kycStatus"))}>
        {row.getValue("kycStatus")}
      </StatusBadge>
    ),
  },
  { accessorKey: "plotsCount", header: "Plots" },
  { accessorKey: "policiesCount", header: "Policies" },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
];

export default function FarmersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const orgId = user?.organizationId || "";

  const { data, isLoading } = useQuery({
    queryKey: ["farmers", orgId],
    queryFn: () => api.getFarmers(orgId),
    enabled: !!orgId,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Farmers</h1>
          <p className="text-muted-foreground">Manage farmer registrations and KYC</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/org/farmers/import"><Upload className="mr-2 h-4 w-4" />Import</Link>
          </Button>
          <Button variant="outline"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
      </div>
      <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} searchKey="firstName" searchPlaceholder="Search farmers..." onRowClick={(row) => navigate(`/org/farmers/${row.id}`)} />
    </div>
  );
}
