import { Loader2, Settings, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { PoolStatus } from '@/types';

interface PoolSettingsCardProps {
  pool: PoolStatus;
  onToggleDeposits: (enabled: boolean) => Promise<void>;
  onToggleWithdrawals: (enabled: boolean) => Promise<void>;
  isDepositsLoading?: boolean;
  isWithdrawalsLoading?: boolean;
}

export function PoolSettingsCard({
  pool,
  onToggleDeposits,
  onToggleWithdrawals,
  isDepositsLoading = false,
  isWithdrawalsLoading = false,
}: PoolSettingsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Pool Settings
        </CardTitle>
        <CardDescription>
          Control deposits and withdrawals for your insurance pool
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="deposits-toggle" className="text-base">
              Accept Deposits
            </Label>
            <p className="text-sm text-muted-foreground">
              Allow investors to deposit USDC into the pool
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDepositsLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              id="deposits-toggle"
              checked={pool.depositsOpen}
              onCheckedChange={onToggleDeposits}
              disabled={isDepositsLoading || pool.paused}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="withdrawals-toggle" className="text-base">
              Allow Withdrawals
            </Label>
            <p className="text-sm text-muted-foreground">
              Allow investors to withdraw USDC from the pool
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isWithdrawalsLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              id="withdrawals-toggle"
              checked={pool.withdrawalsOpen}
              onCheckedChange={onToggleWithdrawals}
              disabled={isWithdrawalsLoading || pool.paused}
            />
          </div>
        </div>

        {pool.paused && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            Pool is currently paused. Settings cannot be changed until the pool is unpaused.
          </div>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            These settings control on-chain pool parameters. Changes require a blockchain transaction and may not be available on all networks.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
