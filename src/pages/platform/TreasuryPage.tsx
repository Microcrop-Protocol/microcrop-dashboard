import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  DollarSign,
  ArrowUpFromLine,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Percent,
  Construction,
} from "lucide-react";

export default function TreasuryPage() {
  const { data: treasury, isLoading, error } = useQuery({
    queryKey: ["treasury"],
    queryFn: () => api.getTreasuryStats(),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show fallback UI when API is not available
  if (error || !treasury) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Platform Treasury</h1>
          <p className="text-muted-foreground">
            Manage platform funds and monitor reserve requirements
          </p>
        </div>

        {/* Coming Soon Card */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Construction className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Treasury Management Coming Soon</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              The treasury API is not yet available. This feature will allow you to monitor platform funds, fees, and reserve requirements.
            </p>
            <div className="flex gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>API endpoint not available</span>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Premiums"
            value="--"
            icon={Wallet}
            description="All-time premiums collected"
          />
          <StatCard
            title="Total Payouts"
            value="--"
            icon={ArrowUpFromLine}
            description="All-time claims paid"
          />
          <StatCard
            title="Accumulated Fees"
            value="--"
            icon={DollarSign}
            description="Platform fees earned"
          />
          <StatCard
            title="Available for Payouts"
            value="--"
            icon={TrendingUp}
            description="Funds available for claims"
          />
        </div>
      </div>
    );
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);

  const reserveUtilization = (treasury.requiredReserve / treasury.balance) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Platform Treasury</h1>
          <p className="text-muted-foreground">
            Manage platform funds and monitor reserve requirements
          </p>
        </div>
        <div className="flex gap-2">
          {treasury.paused ? (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Treasury Paused
            </Badge>
          ) : (
            <Badge variant="default" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Active
            </Badge>
          )}
          {treasury.meetsReserve ? (
            <Badge variant="default" className="gap-1 bg-green-600">
              Reserve Met
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Below Reserve
            </Badge>
          )}
        </div>
      </div>

      {/* Main Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle>Treasury Balance</CardTitle>
          <CardDescription>Total funds available in the platform treasury</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary">{formatCurrency(treasury.balance)}</p>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Reserve Utilization</span>
              <span className="font-medium">{reserveUtilization.toFixed(1)}%</span>
            </div>
            <Progress
              value={Math.min(reserveUtilization, 100)}
              className={`h-2 ${!treasury.meetsReserve ? "[&>div]:bg-destructive" : ""}`}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required reserve: {formatCurrency(treasury.requiredReserve)} ({treasury.reserveRatio}% ratio)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Premiums"
          value={formatCurrency(treasury.totalPremiums)}
          icon={Wallet}
          description="All-time premiums collected"
        />
        <StatCard
          title="Total Payouts"
          value={formatCurrency(treasury.totalPayouts)}
          icon={ArrowUpFromLine}
          description="All-time claims paid"
        />
        <StatCard
          title="Accumulated Fees"
          value={formatCurrency(treasury.accumulatedFees)}
          icon={DollarSign}
          description="Platform fees earned"
        />
        <StatCard
          title="Available for Payouts"
          value={formatCurrency(treasury.availableForPayouts)}
          icon={TrendingUp}
          description="Funds available for claims"
        />
      </div>

      {/* Configuration Details */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Fee Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Fee</span>
              <span className="font-medium">{treasury.platformFeePercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reserve Ratio</span>
              <span className="font-medium">{treasury.reserveRatio}%</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Required Reserve</span>
              <span className="font-bold">{formatCurrency(treasury.requiredReserve)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Health Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Reserve Status</span>
              <Badge variant={treasury.meetsReserve ? "default" : "destructive"}>
                {treasury.meetsReserve ? "Healthy" : "Below Requirement"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Treasury Status</span>
              <Badge variant={treasury.paused ? "destructive" : "default"}>
                {treasury.paused ? "Paused" : "Active"}
              </Badge>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Loss Ratio</span>
              <span className="font-bold">
                {((treasury.totalPayouts / treasury.totalPremiums) * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning if below reserve */}
      {!treasury.meetsReserve && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Reserve Warning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The treasury balance is below the required reserve ratio. Consider adding funds
              or reviewing payout schedules to ensure sufficient liquidity for claims.
            </p>
            <div className="mt-4 flex gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Current Balance</p>
                <p className="font-medium">{formatCurrency(treasury.balance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Required Reserve</p>
                <p className="font-medium text-destructive">
                  {formatCurrency(treasury.requiredReserve)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Shortfall</p>
                <p className="font-medium text-destructive">
                  {formatCurrency(treasury.requiredReserve - treasury.balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
