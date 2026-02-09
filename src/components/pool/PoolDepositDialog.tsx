import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowDownToLine } from 'lucide-react';
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
import { poolDepositSchema, type PoolDepositFormData } from '@/lib/validations/pool';
import type { PoolStatus } from '@/types';

interface PoolDepositDialogProps {
  pool: PoolStatus;
  onSubmit: (data: PoolDepositFormData) => Promise<void>;
  isLoading?: boolean;
  trigger?: React.ReactNode;
}

export function PoolDepositDialog({
  pool,
  onSubmit,
  isLoading = false,
  trigger,
}: PoolDepositDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<PoolDepositFormData>({
    resolver: zodResolver(poolDepositSchema),
    defaultValues: {
      amount: undefined,
      minTokensOut: 0,
    },
  });

  const watchAmount = form.watch('amount');
  const estimatedTokens = watchAmount && pool.tokenPrice > 0
    ? (watchAmount / pool.tokenPrice).toFixed(2)
    : '0.00';

  const handleSubmit = async (data: PoolDepositFormData) => {
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button disabled={!pool.depositsOpen || pool.paused}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Deposit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit USDC</DialogTitle>
          <DialogDescription>
            Add liquidity to your insurance pool. You will receive LP tokens in return.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (USDC)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="1000"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>
                    Min: {formatCurrency(pool.minDeposit)} | Max: {formatCurrency(pool.maxDeposit)}
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
                <span className="text-muted-foreground">Estimated LP Tokens</span>
                <span className="font-medium">{estimatedTokens}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pool Utilization</span>
                <span className="font-medium">{pool.utilizationRate.toFixed(1)}%</span>
              </div>
            </div>

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
                Deposit
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
