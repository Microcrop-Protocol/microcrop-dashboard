import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BarChartProps {
  data: unknown[];
  xKey: string;
  yKeys?: { key: string; name: string; color: string }[];
  title?: string;
  className?: string;
  height?: number;
  horizontal?: boolean;
  colors?: string[];
  formatYAxis?: (value: number) => string;
}

const defaultColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function BarChart({ data, xKey, yKeys, title, className, height = 300, horizontal = false, colors = defaultColors, formatYAxis }: BarChartProps) {
  const simpleMode = !yKeys;
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
          <RechartsBarChart data={chartData} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 10, right: 10, left: horizontal ? 80 : 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            {horizontal ? (
              <><XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={formatYAxis} /><YAxis type="category" dataKey={xKey} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={70} /></>
            ) : (
              <><XAxis dataKey={xKey} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={formatYAxis} /></>
            )}
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            {!simpleMode && <Legend />}
            {simpleMode ? (
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>{chartData.map((_, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}</Bar>
            ) : (
              yKeys?.map((yKey) => <Bar key={yKey.key} dataKey={yKey.key} name={yKey.name} fill={yKey.color} radius={[4, 4, 0, 0]} />)
            )}
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
