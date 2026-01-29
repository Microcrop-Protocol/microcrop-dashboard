import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LineChartProps {
  data: unknown[];
  xKey: string;
  yKeys: { key: string; name: string; color: string }[];
  title?: string;
  className?: string;
  height?: number;
  formatYAxis?: (value: number) => string;
}

export function LineChart({ data, xKey, yKeys, title, className, height = 300, formatYAxis }: LineChartProps) {
  // Ensure data is always an array
  const chartData = (Array.isArray(data) ? data : []) as Record<string, unknown>[];

  if (chartData.length === 0) {
    return (
      <Card className={cn(className)}>
        {title && <CardHeader className="pb-2"><CardTitle className="text-base font-medium">{title}</CardTitle></CardHeader>}
        <CardContent className={cn("flex items-center justify-center text-muted-foreground", !title && "pt-6")} style={{ height }}>
          No data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      {title && <CardHeader className="pb-2"><CardTitle className="text-base font-medium">{title}</CardTitle></CardHeader>}
      <CardContent className={cn(!title && "pt-6")}>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsLineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={formatYAxis} className="text-muted-foreground" />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Legend />
            {yKeys.map((yKey) => <Line key={yKey.key} type="monotone" dataKey={yKey.key} name={yKey.name} stroke={yKey.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
