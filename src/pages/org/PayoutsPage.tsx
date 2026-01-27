import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mockData";
import { StatCard } from "@/components/dashboard/StatCard";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Payout } from "@/types";
import { DollarSign, Hash, TrendingUp, CheckCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const columns: ColumnDef<Payout>[] = [
  { accessorKey: "policyNumber", header: "Policy" },
  { accessorKey: "farmerName", header: "Farmer" },
  { accessorKey: "farmerPhone", header: "Phone" },
  { accessorKey: "amount", header: "Amount", cell: ({ row }) => `KES ${(row.getValue("amount") as number).toLocaleString()}` },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge variant={getStatusVariant(row.getValue("status"))}>{row.getValue("status")}</StatusBadge> },
  { accessorKey: "createdAt", header: "Date", cell: ({ row }) => format(new Date(row.getValue("createdAt")), "MMM d, yyyy") },
  { id: "actions", cell: ({ row }) => row.original.status === 'FAILED' && <Button size="sm" variant="outline"><RefreshCw className="mr-1 h-3 w-3" />Retry</Button> },
];

export default function PayoutsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["payouts"], queryFn: () => mockApi.getPayouts("org1") });
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
