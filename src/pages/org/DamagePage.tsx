import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mockData";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { DamageAssessment } from "@/types";
import { format } from "date-fns";

const columns: ColumnDef<DamageAssessment>[] = [
  { accessorKey: "policyNumber", header: "Policy" },
  { accessorKey: "plotName", header: "Plot" },
  { accessorKey: "combinedDamageScore", header: "Damage %", cell: ({ row }) => { const s = (row.getValue("combinedDamageScore") as number) * 100; return <span className={s >= 60 ? "text-error font-medium" : s >= 30 ? "text-warning font-medium" : "text-success"}>{s.toFixed(0)}%</span>; } },
  { accessorKey: "isTriggered", header: "Triggered", cell: ({ row }) => <StatusBadge variant={row.getValue("isTriggered") ? "success" : "default"}>{row.getValue("isTriggered") ? "Yes" : "No"}</StatusBadge> },
  { accessorKey: "assessmentDate", header: "Date", cell: ({ row }) => format(new Date(row.getValue("assessmentDate")), "MMM d, yyyy") },
];

export default function DamagePage() {
  const { data, isLoading } = useQuery({ queryKey: ["damage"], queryFn: () => mockApi.getDamageAssessments() });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Damage Assessments</h1><p className="text-muted-foreground">View weather and satellite damage scores</p></div>
      <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} searchKey="policyNumber" />
    </div>
  );
}
