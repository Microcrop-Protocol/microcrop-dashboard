/**
 * Approve or reject a farmer's KYC.
 *
 * Bulk-imported farmers are created `PENDING` (the CSV schema cannot carry a
 * decision), and `POST /policies/purchase` refuses any farmer whose kycStatus is
 * not `APPROVED` — so without this control an imported book of farmers can never
 * be sold a policy.
 *
 * Backed by `PUT /api/farmers/:farmerId/kyc` (permission `kyc:decide`). The
 * backend requires a `reason` when the decision is REJECTED, so rejection is a
 * two-stage control rather than a single click.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge, getStatusVariant } from '@/components/ui/status-badge';
import { notifySuccess, notifyError } from '@/lib/notify';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import type { Farmer } from '@/types';

export function FarmerKycDecision({ farmer }: { farmer: Farmer }) {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const kycMutation = useMutation({
    mutationFn: (vars: { status: 'APPROVED' | 'REJECTED'; reason?: string }) =>
      api.updateFarmerKyc(farmer.id, vars),
    onSuccess: (_result, vars) => {
      setRejecting(false);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['farmer', farmer.id] });
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      notifySuccess(
        vars.status === 'APPROVED' ? 'KYC approved' : 'KYC rejected',
        vars.status === 'APPROVED'
          ? `${farmer.firstName} ${farmer.lastName} can now be sold policies.`
          : `${farmer.firstName} ${farmer.lastName} cannot be sold policies until KYC is re-submitted.`,
      );
    },
    onError: (error) => notifyError(error, "Couldn't record the KYC decision."),
  });

  // The server-side gate is the real enforcement; this only avoids offering an
  // action that would come back 403.
  const canDecide = can.decideKyc;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">KYC Verification</CardTitle>
          <StatusBadge variant={getStatusVariant(farmer.kycStatus)}>{farmer.kycStatus}</StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {farmer.kycStatus === 'APPROVED' ? (
          <p className="text-sm text-muted-foreground">
            This farmer is verified and can be sold policies.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {farmer.kycStatus === 'REJECTED'
              ? 'This farmer was rejected and cannot be sold policies.'
              : 'KYC is pending. Policies cannot be sold to this farmer until it is approved.'}
          </p>
        )}

        {/* The column is `kycRejectedReason` (Prisma, passed through verbatim).
            Reading `kycRejectionReason` yielded undefined, so the reason a farmer
            was rejected never reached the operator who had to act on it. */}
        {farmer.kycStatus === 'REJECTED' && farmer.kycRejectedReason && (
          <p className="rounded-md bg-muted/50 p-3 text-sm">
            <span className="font-medium">Reason:</span> {farmer.kycRejectedReason}
          </p>
        )}

        {!canDecide ? (
          <p className="text-sm text-muted-foreground">
            Only an organization admin can approve or reject KYC.
          </p>
        ) : rejecting ? (
          <div className="space-y-2">
            <Input
              placeholder="Reason for rejection (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={kycMutation.isPending || !reason.trim()}
                onClick={() => kycMutation.mutate({ status: 'REJECTED', reason: reason.trim() })}
              >
                {kycMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm rejection
              </Button>
              <Button
                variant="outline"
                disabled={kycMutation.isPending}
                onClick={() => { setRejecting(false); setReason(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {farmer.kycStatus !== 'APPROVED' && (
              <Button
                disabled={kycMutation.isPending}
                onClick={() => kycMutation.mutate({ status: 'APPROVED' })}
              >
                {kycMutation.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <ShieldCheck className="mr-2 h-4 w-4" />}
                Approve KYC
              </Button>
            )}
            {farmer.kycStatus !== 'REJECTED' && (
              <Button
                variant="outline"
                disabled={kycMutation.isPending}
                onClick={() => { setRejecting(true); setReason(''); }}
              >
                <ShieldAlert className="mr-2 h-4 w-4" /> Reject KYC
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
