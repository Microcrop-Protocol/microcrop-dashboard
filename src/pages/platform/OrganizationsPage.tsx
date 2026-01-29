import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { KYBStatusBadge } from "@/components/kyb/KYBStatusBadge";
import { ColumnDef } from "@tanstack/react-table";
import { Organization } from "@/types";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { CreateOrganizationDialog } from "@/components/platform/CreateOrganizationDialog";
import { useToast } from "@/hooks/use-toast";
import type { AdminCreateOrganizationFormData } from "@/lib/validations/kyb";

const columns: ColumnDef<Organization>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue("name")}</div>
        {row.original.contactPersonName && (
          <div className="text-sm text-muted-foreground">{row.original.contactPersonName}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => (
      <StatusBadge variant={getStatusVariant(row.getValue("type"))}>
        {(row.getValue("type") as string).charAt(0) + (row.getValue("type") as string).slice(1).toLowerCase()}
      </StatusBadge>
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
    accessorKey: "kybStatus",
    header: "KYB",
    cell: ({ row }) => {
      const kybStatus = row.original.kybStatus;
      if (!kybStatus) return <span className="text-muted-foreground text-sm">-</span>;
      return <KYBStatusBadge status={kybStatus} />;
    },
  },
  {
    accessorKey: "farmersCount",
    header: "Farmers",
    cell: ({ row }) => row.getValue("farmersCount")?.toLocaleString(),
  },
  {
    accessorKey: "policiesCount",
    header: "Policies",
    cell: ({ row }) => row.getValue("policiesCount")?.toLocaleString(),
  },
  {
    accessorKey: "payoutsCount",
    header: "Payouts",
    cell: ({ row }) => row.getValue("payoutsCount")?.toLocaleString(),
  },
  {
    accessorKey: "usersCount",
    header: "Users",
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
];

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => api.getOrganizations(),
  });

  const handleCreateOrganization = async (data: AdminCreateOrganizationFormData) => {
    setIsCreating(true);
    try {
      const newOrg = await api.adminCreateOrganization(data);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast({
        title: "Organization Created",
        description: `${newOrg.name} has been created successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const filteredData = (data?.data ?? []).filter((org) => {
    const matchesType = typeFilter === "all" || org.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? org.isActive : !org.isActive);
    const matchesSearch =
      search === "" ||
      org.name.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">
            Manage all organizations on the platform
          </p>
        </div>
        <CreateOrganizationDialog
          onSubmit={handleCreateOrganization}
          isLoading={isCreating}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="COOPERATIVE">Cooperative</SelectItem>
            <SelectItem value="AGGREGATOR">Aggregator</SelectItem>
            <SelectItem value="INSURER">Insurer</SelectItem>
            <SelectItem value="GOVERNMENT">Government</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/platform/organizations/${row.id}`)}
      />
    </div>
  );
}
