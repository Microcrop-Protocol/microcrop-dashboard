import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PieChartProps {
  data: { name: string; value: number }[];
  title?: string;
  className?: string;
  height?: number;
  colors?: string[];
  innerRadius?: number;
  showLegend?: boolean;
}

const defaultColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function PieChart({ data, title, className, height = 300, colors = defaultColors, innerRadius = 60, showLegend = true }: PieChartProps) {
  // Ensure data is always an array
  const chartData = Array.isArray(data) ? data : [];

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
          <RechartsPieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={innerRadius + 40} paddingAngle={2} dataKey="value" nameKey="name">
              {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} strokeWidth={0} />)}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [value.toLocaleString(), ""]} />
            {showLegend && <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />}
          </RechartsPieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
