import { Wallet, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FundWalletDialog } from './FundWalletDialog';
import type { OrgWallet, WalletFundResult } from '@/types';
import type { FundWalletFormData } from '@/lib/validations/pool';

interface WalletCardProps {
  wallet: OrgWallet;
  onFund: (data: FundWalletFormData) => Promise<WalletFundResult>;
  isFunding: boolean;
}

export function WalletCard({ wallet, onFund, isFunding }: WalletCardProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!wallet.walletAddress) return;
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

  // No wallet yet
  if (!wallet.walletCreated || !wallet.walletAddress) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-4 py-6">
          <div className="rounded-full bg-muted p-3">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No Wallet</p>
            <p className="text-sm text-muted-foreground">
              {wallet.message || 'Deploy a pool to create your organization wallet.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const usdcBalance = wallet.balances?.usdc ?? '0.00';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Organization Wallet
          </CardTitle>
          <CardDescription className="mt-1">
            Fund your wallet to deposit into the pool
          </CardDescription>
        </div>
        <FundWalletDialog onSubmit={onFund} isLoading={isFunding} />
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* USDC Balance */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">USDC Balance</p>
            <p className="mt-1 text-2xl font-bold text-primary">
              ${formatBalance(usdcBalance)}
            </p>
          </div>

          {/* Wallet Address */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Wallet Address</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sm">
                {wallet.walletAddress.slice(0, 6)}...{wallet.walletAddress.slice(-4)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={copyAddress}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                asChild
              >
                <a
                  href={`https://basescan.org/address/${wallet.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
