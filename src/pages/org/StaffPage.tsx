import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { User } from "@/types";
import { mockUsers } from "@/lib/mockData";
import { UserPlus } from "lucide-react";
import { format } from "date-fns";

const columns: ColumnDef<User>[] = [
  { accessorKey: "firstName", header: "First Name" },
  { accessorKey: "lastName", header: "Last Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role", cell: ({ row }) => <StatusBadge variant={getStatusVariant(row.getValue("role"))}>{(row.getValue("role") as string).replace(/_/g, " ")}</StatusBadge> },
  { accessorKey: "isActive", header: "Status", cell: ({ row }) => <StatusBadge variant={row.getValue("isActive") ? "active" : "expired"}>{row.getValue("isActive") ? "Active" : "Inactive"}</StatusBadge> },
  { accessorKey: "lastLoginAt", header: "Last Login", cell: ({ row }) => row.getValue("lastLoginAt") ? format(new Date(row.getValue("lastLoginAt") as string), "MMM d, yyyy") : "-" },
];

export default function StaffPage() {
  const staff = mockUsers.filter(u => u.organizationId === 'org1');

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div><h1 className="text-2xl font-bold">Staff Management</h1><p className="text-muted-foreground">Manage organization staff and roles</p></div>
        <Button><UserPlus className="mr-2 h-4 w-4" />Invite Staff</Button>
      </div>
      <DataTable columns={columns} data={staff} searchKey="email" />
    </div>
  );
}
