import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Banknote,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FundWalletDialog } from '@/components/pool/FundWalletDialog';
import type { FundWalletFormData } from '@/lib/validations/pool';

export default function WalletPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: wallet, isLoading } = useQuery({
    queryKey: ['orgWallet'],
    queryFn: () => api.getOrgWallet(),
    retry: 1,
  });

  const fundWalletMutation = useMutation({
    mutationFn: (data: FundWalletFormData) =>
      api.fundWallet({
        phoneNumber: data.phoneNumber,
        amountKES: data.amountKES,
      }),
    onSuccess: () => {
      toast({
        title: 'M-Pesa Request Sent',
        description: 'Check your phone for the M-Pesa prompt. Balance will update shortly.',
      });
      // Poll wallet balance for updates
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['orgWallet'] });
      }, 5000);
      setTimeout(() => clearInterval(interval), 120000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Funding Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const copyAddress = async () => {
    if (!wallet?.walletAddress) return;
    await navigator.clipboard.writeText(wallet.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBalance = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  const hasWallet = wallet?.walletCreated && wallet?.walletAddress;

  // No wallet state
  if (!hasWallet) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-muted-foreground">Manage your organization wallet</p>
        </div>

        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Wallet className="h-12 w-12 text-primary" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Wallet Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {wallet?.message || 'Deploy a liquidity pool to automatically create your organization wallet.'}
            </p>
            <Button asChild>
              <Link to="/org/pool">
                Go to Pool
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const usdcBalance = wallet.balances?.usdc ?? '0.00';
  const ethBalance = wallet.balances?.eth ?? '0.00';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-muted-foreground">Manage your organization wallet</p>
        </div>
        <FundWalletDialog
          onSubmit={async (data) => fundWalletMutation.mutateAsync(data)}
          isLoading={fundWalletMutation.isPending}
          trigger={
            <Button>
              <Banknote className="mr-2 h-4 w-4" aria-hidden="true" />
              Fund via M-Pesa
            </Button>
          }
        />
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          title="USDC Balance"
          value={`$${formatBalance(usdcBalance)}`}
          icon={Wallet}
          subtitle="Available balance"
        />
        <StatCard
          title="ETH Balance"
          value={`${formatBalance(ethBalance)} ETH`}
          icon={Banknote}
          subtitle="For gas fees"
        />
        <StatCard
          title="Network"
          value="Base"
          icon={ExternalLink}
          subtitle="Layer 2 (Ethereum)"
        />
      </div>

      {/* Wallet Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" aria-hidden="true" />
            Wallet Details
          </CardTitle>
          <CardDescription>Your organization's blockchain wallet on Base</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Full Address */}
          <div>
            <label className="text-sm text-muted-foreground">Wallet Address</label>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-muted px-3 py-2 font-mono text-sm break-all flex-1 min-w-0">
                {wallet.walletAddress}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={copyAddress}
                aria-label="Copy address"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                asChild
                aria-label="View on Basescan"
              >
                <a
                  href={`https://basescan.org/address/${wallet.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>

          {/* Balance Breakdown */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">USDC Balance</p>
              <p className="mt-1 text-2xl font-bold text-primary tabular-nums">
                ${formatBalance(usdcBalance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Used for pool deposits and policy operations
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">ETH Balance</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatBalance(ethBalance)} ETH
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Used for transaction gas fees on Base
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fund Wallet Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" aria-hidden="true" />
            Fund Your Wallet
          </CardTitle>
          <CardDescription>
            Add USDC to your wallet using M-Pesa mobile money
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="font-medium">1. Initiate Payment</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your Safaricom phone number and amount in KES
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="font-medium">2. Confirm on Phone</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You'll receive an M-Pesa STK push to confirm the payment
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="font-medium">3. Receive USDC</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  USDC will appear in your wallet within 1-2 minutes
                </p>
              </div>
            </div>
            <FundWalletDialog
              onSubmit={async (data) => fundWalletMutation.mutateAsync(data)}
              isLoading={fundWalletMutation.isPending}
              trigger={
                <Button className="w-full sm:w-auto">
                  <Banknote className="mr-2 h-4 w-4" aria-hidden="true" />
                  Fund via M-Pesa
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
