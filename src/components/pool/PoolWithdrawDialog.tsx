import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowUpFromLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { poolWithdrawSchema, type PoolWithdrawFormData } from '@/lib/validations/pool';
import type { PoolStatus, LiquidityPool } from '@/types';

interface PoolWithdrawDialogProps {
  pool: PoolStatus;
  liquidityPool?: LiquidityPool;
  onSubmit: (data: PoolWithdrawFormData) => Promise<void>;
  isLoading?: boolean;
  trigger?: React.ReactNode;
}

export function PoolWithdrawDialog({
  pool,
  liquidityPool,
  onSubmit,
  isLoading = false,
  trigger,
}: PoolWithdrawDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<PoolWithdrawFormData>({
    resolver: zodResolver(poolWithdrawSchema),
    defaultValues: {
      tokenAmount: undefined,
      minUsdcOut: 0,
    },
  });

  const watchTokenAmount = form.watch('tokenAmount');
  const estimatedUsdc = watchTokenAmount && pool.tokenPrice > 0
    ? (watchTokenAmount * pool.tokenPrice).toFixed(2)
    : '0.00';

  const handleSubmit = async (data: PoolWithdrawFormData) => {
    await onSubmit(data);
    setOpen(false);
    form.reset();
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);

  const availableForWithdrawal = liquidityPool?.availableForWithdrawal ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" disabled={!pool.withdrawalsOpen || pool.paused}>
            <ArrowUpFromLine className="mr-2 h-4 w-4" />
            Withdraw
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw USDC</DialogTitle>
          <DialogDescription>
            Remove liquidity from your pool by burning LP tokens.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tokenAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LP Tokens to Burn</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="1000"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>
                    Available: {formatCurrency(availableForWithdrawal)} USDC
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Token Price</span>
                <span className="font-medium">{formatCurrency(pool.tokenPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated USDC Received</span>
                <span className="font-medium">{formatCurrency(parseFloat(estimatedUsdc))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pool Utilization</span>
                <span className="font-medium">{pool.utilizationRate.toFixed(1)}%</span>
              </div>
            </div>

            {pool.utilizationRate > 80 && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                High utilization may limit withdrawal amounts
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Withdraw
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
