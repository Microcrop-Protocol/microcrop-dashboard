import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Smartphone, CheckCircle } from 'lucide-react';
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
import { fundWalletSchema, type FundWalletFormData } from '@/lib/validations/pool';
import type { WalletFundResult } from '@/types';

interface FundWalletDialogProps {
  onSubmit: (data: FundWalletFormData) => Promise<WalletFundResult>;
  isLoading?: boolean;
  trigger?: React.ReactNode;
}

export function FundWalletDialog({
  onSubmit,
  isLoading = false,
  trigger,
}: FundWalletDialogProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<WalletFundResult | null>(null);

  const form = useForm<FundWalletFormData>({
    resolver: zodResolver(fundWalletSchema),
    defaultValues: {
      phoneNumber: '',
      amountKES: undefined,
    },
  });

  const handleSubmit = async (data: FundWalletFormData) => {
    const res = await onSubmit(data);
    setResult(res);
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      form.reset();
      setResult(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Smartphone className="mr-2 h-4 w-4" />
            Fund via M-Pesa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                M-Pesa Request Sent
              </DialogTitle>
              <DialogDescription>
                {result.instructions}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono text-xs">{result.orderId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{result.status}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wallet</span>
                <span className="font-mono text-xs">
                  {result.walletAddress.slice(0, 6)}...{result.walletAddress.slice(-4)}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-info/10 p-3 text-sm text-muted-foreground">
              USDC will appear in your wallet balance once the M-Pesa payment is confirmed. This usually takes 1-2 minutes.
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Fund Wallet via M-Pesa</DialogTitle>
              <DialogDescription>
                Enter your Safaricom number and amount. An STK push will be sent to your phone.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="0712345678"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Safaricom M-Pesa number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amountKES"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (KES)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="50000"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormDescription>
                        USDC will be sent to your wallet after payment confirms
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                  You will receive an M-Pesa STK push on your phone. Enter your M-Pesa PIN to confirm the payment.
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleClose(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send M-Pesa Request
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
