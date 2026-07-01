import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColumnDef } from "@tanstack/react-table";
import { User } from "@/types";
import { UserPlus, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { notifySuccess, notifyError } from "@/lib/notify";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const columns: ColumnDef<User>[] = [
  { accessorKey: "firstName", header: "First Name" },
  { accessorKey: "lastName", header: "Last Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role", cell: ({ row }) => <StatusBadge variant={getStatusVariant(row.getValue("role"))}>{(row.getValue("role") as string).replace(/_/g, " ")}</StatusBadge> },
  { accessorKey: "isActive", header: "Status", cell: ({ row }) => <StatusBadge variant={row.getValue("isActive") ? "active" : "expired"}>{row.getValue("isActive") ? "Active" : "Inactive"}</StatusBadge> },
  { accessorKey: "lastLoginAt", header: "Last Login", cell: ({ row }) => formatDate(row.getValue("lastLoginAt")) },
];

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", phone: "", role: "ORG_STAFF" as "ORG_ADMIN" | "ORG_STAFF" });

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api.getStaff(),
  });

  // Guard against a non-array response so DataTable's `.map` can't break.
  const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const nested = record.data ?? record.items ?? record.results;
      if (Array.isArray(nested)) return nested as T[];
    }
    return [];
  };

  const staffList = toArray<User>(staff);

  const inviteMutation = useMutation({
    mutationFn: () => api.inviteStaff(form),
    onSuccess: () => {
      notifySuccess("Invitation sent", `We've sent an invitation to ${form.email}.`);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      setForm({ email: "", firstName: "", lastName: "", phone: "", role: "ORG_STAFF" });
    },
    onError: (error) => {
      notifyError(error, "Couldn't send the invitation. Please try again.");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Management</h1>
          <p className="text-muted-foreground">Manage organization staff and roles</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" />Invite Staff</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Staff Member</DialogTitle>
              <DialogDescription>Send an invitation to join your organization.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={form.firstName} onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="John" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={form.lastName} onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone (Optional)</Label>
                <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+254712345678" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm(p => ({ ...p, role: v as "ORG_ADMIN" | "ORG_STAFF" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORG_STAFF">Staff</SelectItem>
                    <SelectItem value="ORG_ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => inviteMutation.mutate()} disabled={!form.email || !form.firstName || !form.lastName || inviteMutation.isPending}>
                {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={columns}
        data={staffList}
        isLoading={isLoading}
        searchKey="email"
      />
    </div>
  );
}
