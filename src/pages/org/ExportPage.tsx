import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Download, Users, FileText, DollarSign, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { DateRange } from "react-day-picker";

const exports = [
  { title: "Farmers", description: "Export all farmer data including KYC status", icon: Users },
  { title: "Policies", description: "Export policy data with coverage details", icon: FileText },
  { title: "Payouts", description: "Export payout history and status", icon: DollarSign },
  { title: "Transactions", description: "Export all financial transactions", icon: ArrowRightLeft },
];

export default function ExportPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to: new Date() });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Data Export</h1><p className="text-muted-foreground">Download organization data as CSV</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {exports.map(exp => (
          <Card key={exp.title}>
            <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><exp.icon className="h-5 w-5 text-primary" /></div><div><CardTitle className="text-base">{exp.title}</CardTitle><CardDescription>{exp.description}</CardDescription></div></div></CardHeader>
            <CardContent className="flex items-center gap-4">
              <DateRangePicker value={dateRange} onChange={setDateRange} presets={false} />
              <Button><Download className="mr-2 h-4 w-4" />Download</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
