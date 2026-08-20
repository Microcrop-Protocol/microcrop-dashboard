import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, Landmark, Lock } from 'lucide-react';

// Non-custodial model: an insurer's reserve capital is held OFF-PLATFORM in a
// segregated trust on the carrier's own books. MicroCrop never custodies partner
// capital, so there is no on-platform wallet to fund and no deposit/withdraw here.
// The prior deposit/withdraw flow (api.getReserve/depositReserve/withdrawReserve)
// was retired with the custody model. Once the trust integration lands, this page
// will show an attested solvency reference (read-only), not a deposit target.
export default function ReservePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reserve</h1>
        <p className="text-sm text-muted-foreground">
          The capital that backs your policies' payouts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4" /> Held off-platform
          </CardTitle>
          <CardDescription>
            Your reserve stays in your own segregated trust, on your books. MicroCrop is
            non-custodial: we never hold your capital.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            There is no reserve wallet to fund on this dashboard. Depositing capital into a
            platform-held wallet has been removed.
          </p>
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            An attested solvency view (read-only) will appear here once the trust
            integration is connected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
