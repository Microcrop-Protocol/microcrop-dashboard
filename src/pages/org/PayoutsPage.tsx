import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Payout } from "@/types";
import { DollarSign, Hash, TrendingUp, CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { notifySuccess, notifyError } from "@/lib/notify";
import { DeterminationStatusBadge } from "@/components/payouts/DeterminationStatusBadge";

export default function PayoutsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const orgId = user?.organizationId || "";

  const { data, isLoading } = useQuery({
    queryKey: ["payouts", orgId],
    queryFn: () => api.getPayouts(orgId),
    enabled: !!orgId,
  });

  const retryMutation = useMutation({
    mutationFn: (payoutId: string) => api.retryPayout(payoutId),
    onSuccess: () => {
      notifySuccess("Payout retried", "The payout has been resubmitted.");
      queryClient.invalidateQueries({ queryKey: ["payouts", orgId] });
    },
    onError: (error) => {
      notifyError(error, "Couldn't retry the payout. Please try again.");
    },
  });

  const columns: ColumnDef<Payout>[] = [
    { accessorKey: "policyNumber", header: "Policy" },
    { accessorKey: "farmerName", header: "Farmer" },
    { accessorKey: "farmerPhone", header: "Phone" },
    { accessorKey: "amount", header: "Amount", cell: ({ row }) => `KES ${(row.getValue("amount") as number).toLocaleString()}` },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge variant={getStatusVariant(row.getValue("status"))}>{row.getValue("status")}</StatusBadge> },
    {
      id: "determination",
      header: "Settlement",
      cell: ({ row }) => {
        const status = row.original.determination?.status ?? row.original.determinationStatus;
        return status ? <DeterminationStatusBadge status={status} /> : <span className="text-muted-foreground">—</span>;
      },
    },
    { accessorKey: "createdAt", header: "Date", cell: ({ row }) => formatDate(row.getValue("createdAt")) },
    {
      id: "actions",
      cell: ({ row }) =>
        row.original.status === "FAILED" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => retryMutation.mutate(row.original.id)}
            disabled={retryMutation.isPending}
          >
            {retryMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
            Retry
          </Button>
        ),
    },
  ];

  const payouts = data?.data ?? [];
  const total = payouts.reduce((s, p) => s + p.amount, 0);
  const successCount = payouts.filter(p => p.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Payouts</h1><p className="text-muted-foreground">Track and manage farmer payouts</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Amount" value={`KES ${total.toLocaleString()}`} icon={DollarSign} />
        <StatCard title="Avg Payout" value={`KES ${payouts.length ? Math.round(total / payouts.length).toLocaleString() : 0}`} icon={TrendingUp} />
        <StatCard title="Total Payouts" value={payouts.length} icon={Hash} />
        <StatCard title="Success Rate" value={`${payouts.length ? ((successCount / payouts.length) * 100).toFixed(0) : 0}%`} icon={CheckCircle} />
      </div>
      <DataTable columns={columns} data={payouts} isLoading={isLoading} searchKey="policyNumber" />
    </div>
  );
}
