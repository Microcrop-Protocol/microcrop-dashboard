import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AreaChartProps {
  data: unknown[];
  xKey: string;
  yKeys: {
    key: string;
    name: string;
    color: string;
  }[];
  title?: string;
  className?: string;
  height?: number;
  stacked?: boolean;
  formatYAxis?: (value: number) => string;
}

export function AreaChart({
  data,
  xKey,
  yKeys,
  title,
  className,
  height = 300,
  stacked = false,
  formatYAxis,
}: AreaChartProps) {
  // Ensure data is always an array
  const chartData = (Array.isArray(data) ? data : []) as Record<string, unknown>[];

  if (chartData.length === 0) {
    return (
      <Card className={cn(className)}>
        {title && (
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn("flex items-center justify-center text-muted-foreground", !title && "pt-6")} style={{ height }}>
          No data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(!title && "pt-6")}>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsAreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {yKeys.map((yKey) => (
                <linearGradient key={yKey.key} id={`gradient-${yKey.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={yKey.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={yKey.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={formatYAxis} className="text-muted-foreground" />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Legend />
            {yKeys.map((yKey) => (
              <Area key={yKey.key} type="monotone" dataKey={yKey.key} name={yKey.name} stroke={yKey.color} fill={`url(#gradient-${yKey.key})`} strokeWidth={2} stackId={stacked ? "1" : undefined} />
            ))}
          </RechartsAreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
