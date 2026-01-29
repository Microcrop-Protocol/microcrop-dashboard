import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { DamageAssessment } from "@/types";
import { formatDate } from "@/lib/utils";
import { DamageHeatmap } from "@/components/maps/DamageHeatmap";
import { StatCard } from "@/components/dashboard/StatCard";
import { AlertTriangle, ThermometerSun, Satellite, Target } from "lucide-react";

const columns: ColumnDef<DamageAssessment>[] = [
  { accessorKey: "policyNumber", header: "Policy" },
  { accessorKey: "plotName", header: "Plot" },
  { 
    accessorKey: "combinedDamageScore", 
    header: "Damage %", 
    cell: ({ row }) => { 
      const s = (row.getValue("combinedDamageScore") as number) * 100; 
      return (
        <span className={s >= 60 ? "text-destructive font-medium" : s >= 30 ? "text-warning font-medium" : "text-primary font-medium"}>
          {s.toFixed(0)}%
        </span>
      ); 
    } 
  },
  { 
    accessorKey: "isTriggered", 
    header: "Triggered", 
    cell: ({ row }) => (
      <StatusBadge variant={row.getValue("isTriggered") ? "success" : "default"}>
        {row.getValue("isTriggered") ? "Yes" : "No"}
      </StatusBadge>
    ) 
  },
  {
    accessorKey: "assessmentDate",
    header: "Date",
    cell: ({ row }) => formatDate(row.getValue("assessmentDate"))
  },
];

export default function DamagePage() {
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | undefined>();
  const { data, isLoading } = useQuery({
    queryKey: ["damage"],
    queryFn: () => api.getDamageAssessments(),
  });

  const assessments = data?.data ?? [];

  // Calculate summary stats
  const avgWeather = assessments.length > 0 
    ? assessments.reduce((sum, a) => sum + a.weatherDamageScore, 0) / assessments.length 
    : 0;
  const avgSatellite = assessments.length > 0 
    ? assessments.reduce((sum, a) => sum + a.satelliteDamageScore, 0) / assessments.length 
    : 0;
  const avgCombined = assessments.length > 0 
    ? assessments.reduce((sum, a) => sum + a.combinedDamageScore, 0) / assessments.length 
    : 0;
  const triggerRate = assessments.length > 0 
    ? (assessments.filter(a => a.isTriggered).length / assessments.length) * 100 
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Damage Assessments</h1>
        <p className="text-muted-foreground">View weather and satellite damage scores with heatmap visualization</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Avg Weather Score" 
          value={`${(avgWeather * 100).toFixed(1)}%`}
          icon={ThermometerSun}
        />
        <StatCard 
          title="Avg Satellite Score" 
          value={`${(avgSatellite * 100).toFixed(1)}%`}
          icon={Satellite}
        />
        <StatCard 
          title="Avg Combined Score" 
          value={`${(avgCombined * 100).toFixed(1)}%`}
          icon={AlertTriangle}
        />
        <StatCard 
          title="Trigger Rate" 
          value={`${triggerRate.toFixed(1)}%`}
          icon={Target}
        />
      </div>

      {/* Split View: Table + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assessment Records</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable 
              columns={columns} 
              data={assessments} 
              isLoading={isLoading} 
              searchKey="policyNumber"
              onRowClick={(row) => setSelectedAssessmentId(row.id)}
            />
          </CardContent>
        </Card>

        {/* Heatmap */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Damage Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[500px] p-4 pt-0">
              <DamageHeatmap 
                assessments={assessments}
                selectedAssessmentId={selectedAssessmentId}
                onAssessmentSelect={(assessment) => setSelectedAssessmentId(assessment.id)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
