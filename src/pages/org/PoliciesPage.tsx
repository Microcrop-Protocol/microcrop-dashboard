import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { usePermissions } from "@/hooks/usePermissions";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Policy } from "@/types";
import { formatDate } from "@/lib/utils";
import { isSimulatedPolicy } from "@/lib/simulated";
import { SimulatedBadge, SimulatedBanner } from "@/components/ui/simulated-badge";
import { Plus } from "lucide-react";

const columns: ColumnDef<Policy>[] = [
  {
    accessorKey: "policyNumber",
    header: "Policy #",
    // The test-data marker sits against the identifier rather than in a trailing column
    // so it survives a narrow viewport: a sandbox policy reaches ACTIVE exactly like a
    // real one, so the row must announce itself where the eye already is.
    cell: ({ row }) => (
      <div className="flex flex-col items-start gap-1">
        <span>{row.getValue("policyNumber")}</span>
        {isSimulatedPolicy(row.original) && <SimulatedBadge />}
      </div>
    ),
  },
  { accessorKey: "farmerName", header: "Farmer" },
  { accessorKey: "plotName", header: "Plot" },
  { accessorKey: "coverageType", header: "Coverage" },
  { accessorKey: "cropType", header: "Crop" },
  { accessorKey: "sumInsured", header: "Sum Insured", cell: ({ row }) => `KES ${Number(row.getValue("sumInsured")).toLocaleString()}` },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge variant={getStatusVariant(row.getValue("status"))}>{row.getValue("status")}</StatusBadge> },
  { accessorKey: "endDate", header: "Expires", cell: ({ row }) => formatDate(row.getValue("endDate")) },
];

export default function PoliciesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const orgId = user?.organizationId || "";

  const { data, isLoading } = useQuery({
    queryKey: ["policies", orgId],
    queryFn: () => api.getPolicies(orgId),
    enabled: !!orgId,
  });

  const policies = data?.data ?? [];
  const simulatedCount = policies.filter(isSimulatedPolicy).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Policies</h1><p className="text-muted-foreground">Manage crop insurance policies</p></div>
        {can.writePolicies && <Button asChild><Link to="/org/policies/new"><Plus className="mr-2 h-4 w-4" />New Policy</Link></Button>}
      </div>
      {simulatedCount > 0 && (
        <SimulatedBanner>
          {simulatedCount} of these {policies.length} policies {simulatedCount === 1 ? "is" : "are"} test
          data. No premium was collected for {simulatedCount === 1 ? "it" : "them"}, no farmer is
          covered, and {simulatedCount === 1 ? "it is" : "they are"} not recorded on the blockchain —
          even though {simulatedCount === 1 ? "it shows" : "they show"} the same status as a real
          policy. Each one is marked in the list below.
        </SimulatedBanner>
      )}
      <DataTable columns={columns} data={policies} isLoading={isLoading} searchKey="policyNumber" onRowClick={(row) => navigate(`/org/policies/${row.id}`)} />
    </div>
  );
}
