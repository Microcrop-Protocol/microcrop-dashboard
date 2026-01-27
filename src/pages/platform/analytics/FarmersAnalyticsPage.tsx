import { useQuery } from "@tanstack/react-query";
import { mockApi } from "@/lib/mockData";
import { StatCard } from "@/components/dashboard/StatCard";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { GranularitySelect } from "@/components/ui/granularity-select";
import { Users, UserPlus, FileCheck, MapPin } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Granularity } from "@/types";

export default function FarmersAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const { data } = useQuery({
    queryKey: ["farmersAnalytics", dateRange, granularity],
    queryFn: () => mockApi.getFarmersAnalytics(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Farmers Analytics</h1>
          <p className="text-muted-foreground">Track farmer registrations and KYC status</p>
        </div>
        <div className="flex items-center gap-2">
          <GranularitySelect value={granularity} onChange={setGranularity} />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Farmers"
          value={data?.totalFarmers?.toLocaleString() ?? 0}
          icon={Users}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="New This Period"
          value={data?.newFarmers?.toLocaleString() ?? 0}
          icon={UserPlus}
          trend={{ value: 22, isPositive: true }}
        />
        <StatCard
          title="KYC Approved"
          value={`${(((data?.byKycStatus?.find(s => s.name === 'Approved')?.value ?? 0) / (data?.totalFarmers || 1)) * 100).toFixed(0)}%`}
          icon={FileCheck}
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Counties Covered"
          value={data?.byCounty?.length ?? 0}
          icon={MapPin}
        />
      </div>

      {/* Charts */}
      <LineChart
        data={data?.timeSeries ?? []}
        xKey="date"
        yKeys={[{ key: "value", name: "Farmers Registered", color: "hsl(var(--chart-1))" }]}
        title="Farmer Registrations Over Time"
        height={300}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <PieChart data={data?.byKycStatus ?? []} title="Farmers by KYC Status" height={280} />
        <BarChart data={data?.byCounty ?? []} xKey="name" title="Farmers by County" horizontal height={280} />
      </div>
    </div>
  );
}
