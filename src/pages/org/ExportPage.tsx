import { useState } from "react";
import { DateRange } from "react-day-picker";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Download, Users, FileText, DollarSign, ArrowRightLeft, Loader2 } from "lucide-react";
import { notifySuccess, notifyError } from "@/lib/notify";

const exportConfigs = [
  { title: "Farmers", description: "Export all farmer data including KYC status", icon: Users, key: "farmers" as const },
  { title: "Policies", description: "Export policy data with coverage details", icon: FileText, key: "policies" as const },
  { title: "Payouts", description: "Export payout history and status", icon: DollarSign, key: "payouts" as const },
  { title: "Transactions", description: "Export all financial transactions", icon: ArrowRightLeft, key: "transactions" as const },
];

const exportFns = {
  farmers: api.exportFarmers,
  policies: api.exportPolicies,
  payouts: api.exportPayouts,
  transactions: api.exportTransactions,
};

export default function ExportPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to: new Date() });
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (key: keyof typeof exportFns, title: string) => {
    setDownloading(key);
    try {
      const params: { startDate?: string; endDate?: string } = {};
      if (dateRange?.from) params.startDate = dateRange.from.toISOString().slice(0, 10);
      if (dateRange?.to) params.endDate = dateRange.to.toISOString().slice(0, 10);

      const blob = await exportFns[key](params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${key}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess(`${title} exported`, "Your download should begin shortly.");
    } catch (error) {
      notifyError(error, `Couldn't export ${title.toLowerCase()}. Please try again.`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Data Export</h1><p className="text-muted-foreground">Download organization data as CSV</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {exportConfigs.map(exp => (
          <Card key={exp.title}>
            <CardHeader><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><exp.icon className="h-5 w-5 text-primary" /></div><div><CardTitle className="text-base">{exp.title}</CardTitle><CardDescription>{exp.description}</CardDescription></div></div></CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <DateRangePicker value={dateRange} onChange={setDateRange} presets={false} />
              <Button className="w-full sm:w-auto" onClick={() => handleDownload(exp.key, exp.title)} disabled={downloading === exp.key}>
                {downloading === exp.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
