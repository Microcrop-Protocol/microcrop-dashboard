import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { notifySuccess, notifyError } from '@/lib/notify';
import { KybGatingBanner } from '@/components/kyb/KybGatingBanner';
import { ShieldCheck, ShieldAlert, ArrowDownToLine, ArrowUpFromLine, DollarSign, Target, TrendingUp, Loader2 } from 'lucide-react';

const usd = (n: number) => `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function ReservePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Finance can VIEW the reserve, but deposit/withdraw is ORG_ADMIN-only on the backend.
  const { isAdmin } = usePermissions();
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');

  const { data: reserve, isLoading, error } = useQuery({
    queryKey: ['reserve'],
    queryFn: () => api.getReserve(),
    retry: 1,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['reserve'] });
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
  };

  const depositMutation = useMutation({
    mutationFn: (amountUsdc: number) => api.depositReserve({ amountUsdc }),
    onSuccess: (r) => {
      notifySuccess('Reserve funded', `Deposited ${usd(r.amountUsdc)} of reserve capital.`);
      setDepositAmt('');
      invalidate();
    },
    onError: (e) => notifyError(e, "Couldn't fund your reserve. Please try again."),
  });

  const withdrawMutation = useMutation({
    mutationFn: (amountUsdc: number) => api.withdrawReserve({ amountUsdc }),
    onSuccess: (r) => {
      notifySuccess('Surplus withdrawn', `Withdrew ${usd(r.amountUsdc)} of surplus reserve.`);
      setWithdrawAmt('');
      invalidate();
    },
    onError: (e) =>
      notifyError(
        e,
        'That would breach your required reserve. You can only withdraw surplus above the required amount.',
      ),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (error || !reserve?.walletAddress) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Reserve</h1>
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No reserve wallet yet</p>
            <p className="text-sm text-muted-foreground">
              Your organization's wallet must be provisioned before you can fund a reserve. Contact the platform admin to complete onboarding.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const r = reserve;
  const withdrawable = Number.isFinite(r.headroomUsdc) ? r.headroomUsdc : 0;

  const onDeposit = () => {
    const amt = Number(depositAmt);
    if (!amt || amt <= 0) return toast({ title: 'Enter an amount', variant: 'destructive' });
    depositMutation.mutate(amt);
  };
  const onWithdraw = () => {
    const amt = Number(withdrawAmt);
    if (!amt || amt <= 0) return toast({ title: 'Enter an amount', variant: 'destructive' });
    withdrawMutation.mutate(amt);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reserve</h1>
          <p className="text-sm text-muted-foreground">
            Capital that backs your policies' payouts. The contract enforces your required reserve — you can only withdraw surplus.
          </p>
        </div>
        <Badge variant={r.solvent ? 'default' : 'destructive'} className="gap-1">
          {r.solvent ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {r.solvent ? 'Solvent' : 'Underfunded'}
        </Badge>
      </div>

      <KybGatingBanner feature="Funding your reserve" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Reserve balance" value={usd(r.reserveUsdc)} icon={DollarSign} />
        <StatCard title="Required reserve" value={usd(r.requiredUsdc)} icon={Target} />
        <StatCard title="Withdrawable surplus" value={usd(r.headroomUsdc)} icon={TrendingUp} />
      </div>

      {!r.solvent && (
        <Card className="border-destructive">
          <CardContent className="flex items-start gap-3 py-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
            <p className="text-sm">
              Your reserve ({usd(r.reserveUsdc)}) is below the required {usd(r.requiredUsdc)} for your outstanding coverage.
              Top it up to keep payouts flowing — any owed claim is queued and settles automatically once funded.
            </p>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ArrowDownToLine className="h-4 w-4" /> Fund reserve</CardTitle>
            <CardDescription>Move USDC from your org wallet into your on-chain reserve.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input type="number" min="0" step="any" placeholder="Amount (USDC)" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} />
            <Button onClick={onDeposit} disabled={depositMutation.isPending}>
              {depositMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deposit'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ArrowUpFromLine className="h-4 w-4" /> Withdraw surplus</CardTitle>
            <CardDescription>Up to {usd(withdrawable)} above your required reserve.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input type="number" min="0" step="any" placeholder="Amount (USDC)" value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} />
            <Button variant="outline" onClick={onWithdraw} disabled={withdrawMutation.isPending || withdrawable <= 0}>
              {withdrawMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw'}
            </Button>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}
