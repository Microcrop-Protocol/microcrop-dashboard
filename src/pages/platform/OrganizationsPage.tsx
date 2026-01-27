import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { mockApi } from "@/lib/mockData";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { Organization } from "@/types";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Search } from "lucide-react";

const columns: ColumnDef<Organization>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
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
    cell: ({ row }) => format(new Date(row.getValue("createdAt")), "MMM d, yyyy"),
  },
];

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => mockApi.getOrganizations(),
  });

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
      <div>
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-muted-foreground">
          Manage all organizations on the platform
        </p>
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
