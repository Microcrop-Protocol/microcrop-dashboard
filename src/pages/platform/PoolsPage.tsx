import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Wallet,
  Building2,
  Globe,
  Users,
  ExternalLink,
  Plus,
  AlertCircle,
  Construction,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeployPoolDialog } from "@/components/pool/DeployPoolDialog";
import type { DeployPoolFormData } from "@/lib/validations/pool";
import type { PoolType, DeployPoolRequest } from "@/types";

const poolTypeColors: Record<PoolType, string> = {
  PUBLIC: "bg-green-500/10 text-green-700 dark:text-green-400",
  PRIVATE: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  MUTUAL: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

const poolTypeIcons: Record<PoolType, React.ElementType> = {
  PUBLIC: Globe,
  PRIVATE: Building2,
  MUTUAL: Users,
};

export default function PoolsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: poolsData, isLoading: isPoolsLoading, error: poolsError } = useQuery({
    queryKey: ["platformPools"],
    queryFn: () => api.getPlatformPools(),
    retry: 1,
  });

  const { data: poolCounts, isLoading: isCountsLoading, error: countsError } = useQuery({
    queryKey: ["platformPoolCounts"],
    queryFn: () => api.getPlatformPoolCounts(),
    retry: 1,
  });

  const hasError = poolsError || countsError;

  const createPoolMutation = useMutation({
    mutationFn: (data: DeployPoolFormData) =>
      api.createPublicPool({
        name: data.name,
        symbol: data.symbol,
        coverageType: data.coverageType,
        region: data.region,
        targetCapital: data.targetCapital,
        maxCapital: data.maxCapital,
      }),
    onSuccess: (result) => {
      toast({
        title: "Pool Created",
        description: `Pool deployed at ${result.poolAddress.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["platformPools"] });
      queryClient.invalidateQueries({ queryKey: ["platformPoolCounts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create pool",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLoading = isPoolsLoading || isCountsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show fallback UI when API is not available
  if (hasError) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Risk Pools</h1>
          <p className="text-muted-foreground">
            Overview of all liquidity pools on the platform
          </p>
        </div>

        {/* Coming Soon Card */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Construction className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Pool Management Coming Soon</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              The pool management API is not yet available. This feature will allow you to view and manage all risk pools on the platform.
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
            title="Total Pools"
            value="--"
            icon={Wallet}
            description="Active risk pools"
          />
          <StatCard
            title="Private Pools"
            value="--"
            icon={Building2}
            description="Organization-owned"
          />
          <StatCard
            title="Public Pools"
            value="--"
            icon={Globe}
            description="Open to all investors"
          />
          <StatCard
            title="Mutual Pools"
            value="--"
            icon={Users}
            description="Cooperative pools"
          />
        </div>
      </div>
    );
  }

  // If we have partial data, use defaults
  const pools = poolsData?.pools ?? [];
  const counts = poolCounts ?? { total: 0, public: 0, private: 0, mutual: 0 };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);

  const totalValue = pools.reduce((sum, p) => sum + p.poolValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-2xl font-bold">Risk Pools</h1>
          <p className="text-muted-foreground">
            Overview of all liquidity pools on the platform
          </p>
        </div>
        <DeployPoolDialog
          onSubmit={async (data) => {
            await createPoolMutation.mutateAsync(data);
          }}
          isLoading={createPoolMutation.isPending}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Public Pool
            </Button>
          }
        />
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Pools"
          value={counts.total.toString()}
          icon={Wallet}
          description="Active risk pools"
        />
        <StatCard
          title="Private Pools"
          value={counts.private.toString()}
          icon={Building2}
          description="Organization-owned"
        />
        <StatCard
          title="Public Pools"
          value={counts.public.toString()}
          icon={Globe}
          description="Open to all investors"
        />
        <StatCard
          title="Mutual Pools"
          value={counts.mutual.toString()}
          icon={Users}
          description="Cooperative pools"
        />
      </div>

      {/* Total Value Card */}
      <Card>
        <CardHeader>
          <CardTitle>Total Value Locked</CardTitle>
          <CardDescription>Combined value across all pools</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-primary">{formatCurrency(totalValue)}</p>
          {pools.length > 0 && (
            <div className="mt-4 flex gap-4 flex-wrap">
              {pools.slice(0, 4).map((pool, index) => (
                <div key={pool.address} className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: `hsl(${(index * 360) / pools.length}, 70%, 50%)`,
                    }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {pool.name}: {totalValue > 0 ? ((pool.poolValue / totalValue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pools Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Pools</CardTitle>
          <CardDescription>
            {pools.length} pools registered on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pool</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="text-right">Pool Value</TableHead>
                <TableHead className="text-right">Utilization</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map((pool) => {
                const TypeIcon = poolTypeIcons[pool.poolType];
                return (
                  <TableRow key={pool.address}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pool.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {pool.symbol}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`gap-1 ${poolTypeColors[pool.poolType]}`}
                      >
                        <TypeIcon className="h-3 w-3" />
                        {pool.poolType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pool.organizationName ? (
                        <Link
                          to={`/platform/organizations/${pool.organizationId}`}
                          className="text-primary hover:underline"
                        >
                          {pool.organizationName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(pool.poolValue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress
                          value={pool.utilizationRate}
                          className="w-16 h-2"
                        />
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {pool.utilizationRate.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`https://basescan.org/address/${pool.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {pools.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No pools have been created yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
