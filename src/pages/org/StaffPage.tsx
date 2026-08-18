import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColumnDef } from "@tanstack/react-table";
import { User, OrgRole, ORG_ROLES, ORG_ROLE_LABELS } from "@/types";
import { UserPlus, Loader2, Send, Trash2 } from "lucide-react";
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

/**
 * Three states, not two. `acceptedAt == null` means the person was invited but never set
 * a password — the account is dormant and must read Pending, not Active. Only after they
 * accept does isActive decide Active vs Inactive.
 */
function staffStatus(u: User): { label: string; variant: "pending" | "active" | "expired" } {
  if (!u.acceptedAt) return { label: "Pending", variant: "pending" };
  return u.isActive ? { label: "Active", variant: "active" } : { label: "Inactive", variant: "expired" };
}

const columns: ColumnDef<User>[] = [
  { accessorKey: "firstName", header: "First Name" },
  { accessorKey: "lastName", header: "Last Name" },
  { accessorKey: "email", header: "Email" },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as OrgRole;
      return (
        <StatusBadge variant={getStatusVariant(role)}>
          {ORG_ROLE_LABELS[role] ?? role.replace(/_/g, " ")}
        </StatusBadge>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = staffStatus(row.original);
      return <StatusBadge variant={s.variant}>{s.label}</StatusBadge>;
    },
  },
  {
    id: "lastLogin",
    header: "Last Login",
    // GET /api/staff selects `lastLogin`; the old accessor read `lastLoginAt` and so
    // rendered every row empty. Accept either rather than depend on one spelling.
    cell: ({ row }) => formatDate(row.original.lastLogin ?? row.original.lastLoginAt),
  },
];

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", phone: "", role: "ORG_FIELD_AGENT" as OrgRole });

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

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      notifySuccess("Link copied", "Share it with the staff member if the email doesn't arrive.");
    } catch {
      notifyError(new Error(url), "Copy failed — here's the link");
    }
  };

  const inviteMutation = useMutation({
    mutationFn: () => api.inviteStaff(form),
    onSuccess: (result) => {
      notifySuccess("Invitation sent", `We've emailed an invite to ${form.email}. You can also copy the link.`);
      if (result?.inviteUrl) copyLink(result.inviteUrl);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      setForm({ email: "", firstName: "", lastName: "", phone: "", role: "ORG_FIELD_AGENT" });
    },
    onError: (error) => {
      notifyError(error, "Couldn't send the invitation. Please try again.");
    },
  });

  const resendMutation = useMutation({
    mutationFn: (userId: string) => api.resendStaffInvite(userId),
    onSuccess: (result) => {
      notifySuccess("Invitation re-sent", "A fresh link has been emailed and copied to your clipboard.");
      if (result?.inviteUrl) copyLink(result.inviteUrl);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error) => notifyError(error, "Couldn't resend the invitation."),
  });

  const [toDelete, setToDelete] = useState<User | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.deleteStaff(userId),
    onSuccess: () => {
      notifySuccess("Staff removed", `${toDelete?.firstName ?? "The member"} has been removed.`);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setToDelete(null);
    },
    onError: (error) => notifyError(error, "Couldn't remove the staff member."),
  });

  // Row actions need the mutation handlers, so the column lives here rather than in the
  // module-level list. Pending rows also get a Resend; every row gets Remove.
  const actionColumn: ColumnDef<User> = {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const u = row.original;
      return (
        <div className="flex justify-end gap-1">
          {!u.acceptedAt && (
            <Button variant="ghost" size="sm" disabled={resendMutation.isPending} onClick={() => resendMutation.mutate(u.id)}>
              <Send className="mr-1 h-3.5 w-3.5" />
              Resend
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setToDelete(u)}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      );
    },
  };

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
                <Select value={form.role} onValueChange={(v) => setForm(p => ({ ...p, role: v as OrgRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORG_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ORG_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
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
        columns={[...columns, actionColumn]}
        data={staffList}
        isLoading={isLoading}
        searchKey="email"
      />

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove staff member?</DialogTitle>
            <DialogDescription>
              This permanently removes {toDelete?.firstName} {toDelete?.lastName} ({toDelete?.email})
              and frees the email to be invited again. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
