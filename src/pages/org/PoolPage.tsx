import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, DollarSign, ExternalLink, Loader2, TrendingUp, Target, AlertCircle, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PoolDepositDialog } from "@/components/pool/PoolDepositDialog";
import { PoolWithdrawDialog } from "@/components/pool/PoolWithdrawDialog";
import { PoolSettingsCard } from "@/components/pool/PoolSettingsCard";
import { DeployOrgPoolDialog } from "@/components/pool/DeployOrgPoolDialog";
import type { PoolDepositFormData } from "@/lib/validations/pool";
import type { PoolWithdrawFormData } from "@/lib/validations/pool";

export default function PoolPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDepositsLoading, setIsDepositsLoading] = useState(false);
  const [isWithdrawalsLoading, setIsWithdrawalsLoading] = useState(false);

  const { data: pool, isLoading: isPoolLoading, error: poolError } = useQuery({
    queryKey: ["pool"],
    queryFn: () => api.getLiquidityPool(),
    retry: 1,
  });

  const { data: poolDetails, isLoading: isDetailsLoading, error: detailsError } = useQuery({
    queryKey: ["poolDetails"],
    queryFn: () => api.getPoolDetails(),
    retry: 1,
  });

  const hasError = poolError || detailsError;

  const depositMutation = useMutation({
    mutationFn: (data: PoolDepositFormData) => api.depositToPool(data),
    onSuccess: (result) => {
      toast({
        title: "Deposit Successful",
        description: `Minted ${result.tokensMinted} LP tokens. TX: ${result.txHash.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["pool"] });
      queryClient.invalidateQueries({ queryKey: ["poolDetails"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (data: PoolWithdrawFormData) => api.withdrawFromPool(data),
    onSuccess: (result) => {
      toast({
        title: "Withdrawal Successful",
        description: `Received ${result.usdcReceived} USDC. TX: ${result.txHash.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["pool"] });
      queryClient.invalidateQueries({ queryKey: ["poolDetails"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deployPoolMutation = useMutation({
    mutationFn: (data: {
      name?: string;
      symbol?: string;
      poolType: 'PRIVATE' | 'PUBLIC' | 'MUTUAL';
      coverageType: string;
      region: string;
      targetCapital: number;
      maxCapital?: number;
      minDeposit?: number;
      maxDeposit?: number;
      memberContribution?: number;
    }) => api.deployOrgPool(data),
    onSuccess: (result) => {
      toast({
        title: "Pool Deployed Successfully",
        description: `Your pool is live at ${result.pool.poolAddress.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["pool"] });
      queryClient.invalidateQueries({ queryKey: ["poolDetails"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Pool Deployment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleDeposits = async (enabled: boolean) => {
    setIsDepositsLoading(true);
    try {
      await api.updatePoolSettings({ depositsOpen: enabled });
      toast({
        title: enabled ? "Deposits Enabled" : "Deposits Disabled",
        description: `Pool ${enabled ? "now accepts" : "no longer accepts"} deposits.`,
      });
      queryClient.invalidateQueries({ queryKey: ["poolDetails"] });
    } catch (error) {
      toast({
        title: "Settings Not Available",
        description: "Pool settings management is not yet available on this network.",
        variant: "destructive",
      });
    } finally {
      setIsDepositsLoading(false);
    }
  };

  const handleToggleWithdrawals = async (enabled: boolean) => {
    setIsWithdrawalsLoading(true);
    try {
      await api.updatePoolSettings({ withdrawalsOpen: enabled });
      toast({
        title: enabled ? "Withdrawals Enabled" : "Withdrawals Disabled",
        description: `Pool ${enabled ? "now allows" : "no longer allows"} withdrawals.`,
      });
      queryClient.invalidateQueries({ queryKey: ["poolDetails"] });
    } catch (error) {
      toast({
        title: "Settings Not Available",
        description: "Pool settings management is not yet available on this network.",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawalsLoading(false);
    }
  };

  const isLoading = isPoolLoading || isDetailsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if pool data loaded but no pool deployed yet
  const hasNoPool = pool && !pool.address && !hasError;

  // Show deploy pool UI when org doesn't have a pool
  if (hasNoPool) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Liquidity Pool</h1>
          <p className="text-muted-foreground">Deploy and manage your insurance pool</p>
        </div>

        {/* Deploy Pool Card */}
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Wallet className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Pool Deployed</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Your organization doesn't have a risk pool yet. Deploy one to start accepting premiums and managing insurance liquidity.
            </p>
            <DeployOrgPoolDialog
              onSubmit={async (data) => {
                await deployPoolMutation.mutateAsync(data);
              }}
              isLoading={deployPoolMutation.isPending}
            />
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-2">Private Pool</h4>
              <p className="text-sm text-muted-foreground">
                Best for insurance companies. Only whitelisted addresses can deposit liquidity.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-2">Mutual Pool</h4>
              <p className="text-sm text-muted-foreground">
                Best for cooperatives. Members contribute a fixed amount to the shared pool.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-2">Public Pool</h4>
              <p className="text-sm text-muted-foreground">
                Open to all investors. Anyone can deposit and earn returns from premiums.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show fallback UI when API is not available
  if (hasError || !pool || !poolDetails) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Liquidity Pool</h1>
          <p className="text-muted-foreground">Manage your insurance pool liquidity</p>
        </div>

        {/* Coming Soon Card */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Construction className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Pool Management Coming Soon</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              The pool API is not yet available. This feature will allow you to deposit, withdraw, and manage your liquidity pool.
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
            title="Capital Deposited"
            value="--"
            icon={ArrowDownToLine}
            description="Total capital invested"
          />
          <StatCard
            title="Premiums Received"
            value="--"
            icon={Wallet}
            description="From policy sales"
          />
          <StatCard
            title="Payouts Sent"
            value="--"
            icon={ArrowUpFromLine}
            description="Claims paid out"
          />
          <StatCard
            title="Platform Fees"
            value="--"
            icon={DollarSign}
            description="Fees paid to platform"
          />
        </div>
      </div>
    );
  }

  const p = pool;
  const details = poolDetails;
  const formatCurrency = (v: number | null | undefined) => {
    if (v == null) return '--';
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  };
  const formatNumber = (v: number | null | undefined) => {
    if (v == null) return '--';
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Liquidity Pool</h1>
          <p className="text-muted-foreground">Manage your insurance pool liquidity</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PoolDepositDialog
            pool={details}
            onSubmit={async (data) => {
              await depositMutation.mutateAsync(data);
            }}
            isLoading={depositMutation.isPending}
          />
          <PoolWithdrawDialog
            pool={details}
            liquidityPool={p}
            onSubmit={async (data) => {
              await withdrawMutation.mutateAsync(data);
            }}
            isLoading={withdrawMutation.isPending}
          />
          {p.address && (
            <Button variant="outline" asChild>
              <a href={`https://basescan.org/address/${p.address}`} target="_blank" rel="noopener noreferrer">
                {`${p.address.slice(0,6)}...${p.address.slice(-4)}`}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-2">
        {details.paused && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Pool Paused
          </Badge>
        )}
        <Badge variant={details.depositsOpen ? "default" : "secondary"}>
          {details.depositsOpen ? "Deposits Open" : "Deposits Closed"}
        </Badge>
        <Badge variant={details.withdrawalsOpen ? "default" : "secondary"}>
          {details.withdrawalsOpen ? "Withdrawals Open" : "Withdrawals Closed"}
        </Badge>
      </div>

      {/* Pool Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Value</CardTitle>
          <CardDescription>Total value locked in the pool</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary">{formatCurrency(details.poolValue)}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Utilization Rate</span>
                <span className="font-medium">{(details.utilizationRate ?? 0).toFixed(1)}%</span>
              </div>
              <Progress value={details.utilizationRate ?? 0} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Capital Progress</span>
                <span className="font-medium">
                  {details.targetCapital ? (((details.poolValue ?? 0) / details.targetCapital) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <Progress value={details.targetCapital ? ((details.poolValue ?? 0) / details.targetCapital) * 100 : 0} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Capital Deposited"
          value={formatCurrency(p.capitalDeposited)}
          icon={ArrowDownToLine}
          description="Total capital invested"
        />
        <StatCard
          title="Premiums Received"
          value={formatCurrency(p.premiumsReceived)}
          icon={Wallet}
          description="From policy sales"
        />
        <StatCard
          title="Payouts Sent"
          value={formatCurrency(p.payoutsSent)}
          icon={ArrowUpFromLine}
          description="Claims paid out"
        />
        <StatCard
          title="Platform Fees"
          value={formatCurrency(p.feesPaid)}
          icon={DollarSign}
          description="Fees paid to platform"
        />
      </div>

      {/* Token & Capital Details */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              LP Token Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Token Price</span>
              <span className="font-medium">{formatCurrency(details.tokenPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Supply</span>
              <span className="font-medium">{formatNumber(details.totalSupply)} tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Exposure</span>
              <span className="font-medium">{formatCurrency(details.activeExposure)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Available for Withdrawal</span>
              <span className="font-bold text-primary">{formatCurrency(p.availableForWithdrawal)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Capital Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum Deposit</span>
              <span className="font-medium">{formatCurrency(details.minDeposit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Maximum Deposit</span>
              <span className="font-medium">{formatCurrency(details.maxDeposit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Capital</span>
              <span className="font-medium">{formatCurrency(details.targetCapital)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-muted-foreground">Maximum Capital</span>
              <span className="font-bold">{formatCurrency(details.maxCapital)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pool Settings */}
      <PoolSettingsCard
        pool={details}
        onToggleDeposits={handleToggleDeposits}
        onToggleWithdrawals={handleToggleWithdrawals}
        isDepositsLoading={isDepositsLoading}
        isWithdrawalsLoading={isWithdrawalsLoading}
      />
    </div>
  );
}
