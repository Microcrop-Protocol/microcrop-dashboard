import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { User } from "@/types";
import { UserPlus, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

const columns: ColumnDef<User>[] = [
  { accessorKey: "firstName", header: "First Name" },
  { accessorKey: "lastName", header: "Last Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role", cell: ({ row }) => <StatusBadge variant={getStatusVariant(row.getValue("role"))}>{(row.getValue("role") as string).replace(/_/g, " ")}</StatusBadge> },
  { accessorKey: "isActive", header: "Status", cell: ({ row }) => <StatusBadge variant={row.getValue("isActive") ? "active" : "expired"}>{row.getValue("isActive") ? "Active" : "Inactive"}</StatusBadge> },
  { accessorKey: "lastLoginAt", header: "Last Login", cell: ({ row }) => formatDate(row.getValue("lastLoginAt")) },
];

export default function StaffPage() {
  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api.getStaff(),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">Manage organization staff and roles</p>
        </div>
        <Button><UserPlus className="mr-2 h-4 w-4" />Invite Staff</Button>
      </div>
      <DataTable
        columns={columns}
        data={staff ?? []}
        isLoading={isLoading}
        searchKey="email"
      />
    </div>
  );
}
