/**
 * PLATFORM-ADMIN CAPABILITY TOGGLES — per organization, with the reason captured.
 *
 * The backend records who / when / why for every flip (OrgCapabilityChange, written in the same
 * transaction as the grant), so this surface's job is to make sure the "why" it records is worth
 * having. Three consequences of that, all deliberate:
 *
 *   THE REASON IS A DIALOG, NOT AN OPTIONAL BOX. A bare switch would invite "" or "x" — the
 *   backend refuses anything under 10 characters, so a toggle with a nullable reason field would
 *   just produce a validation error AFTER the operator believed they had flipped it. Taking the
 *   reason first means the request only ever goes out complete.
 *
 *   NOTHING IS OPTIMISTIC. A capability change alters what a partner may do. Painting the switch
 *   before the server agrees would show an operator a state that does not exist if the write
 *   fails, which on this surface is a compliance record that is wrong rather than a UI that is
 *   stale. The switch stays where it was until the response lands.
 *
 *   IMPLICIT DENY IS SHOWN AS ITSELF. The API distinguishes `granted: false` (no row ever
 *   written — the capability was never decided) from `enabled: false, granted: true` (someone
 *   switched it off, and there is a reason on file). Both refuse the partner, but they are
 *   different operational situations and collapsing them would hide "nobody has looked at this".
 *
 * WHAT IS DELIBERATELY ABSENT. There is no settlement, payout, determination or peril toggle,
 * because the enum has no such member — gating a drain path on a MUTABLE org-keyed switch would
 * strand cover already sold. Who settles a farmer is `serviceTier` → `Policy.settlementMode`,
 * frozen at inception, and it has its own control. The copy below says so, because an operator
 * looking for "stop paying this partner's claims" must not conclude a capability is the lever.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatDate } from '@/lib/utils';
import {
  CAPABILITIES,
  CAPABILITY_DESCRIPTIONS,
  capabilityLabel,
  isKnownCapability,
} from '@/lib/capability';
import { AlertTriangle, History, Loader2, SlidersHorizontal } from 'lucide-react';
import type { OrgCapability, OrgCapabilityAdminStatus } from '@/types';

/** The backend refuses a shorter reason, in the validator and again in the service. */
const MIN_REASON_LENGTH = 10;

interface PendingChange {
  capability: OrgCapability;
  enabled: boolean;
}

export function OrgCapabilitiesCard({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [reason, setReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['orgCapabilities', orgId],
    queryFn: () => api.platformGetOrgCapabilities(orgId),
    enabled: Boolean(orgId),
  });

  const setMutation = useMutation({
    mutationFn: ({ capability, enabled }: PendingChange) =>
      api.platformSetOrgCapability(orgId, capability, enabled, reason.trim()),
    onSuccess: (result) => {
      notifySuccess(
        result.changed
          ? `${capabilityLabel(result.capability)} ${result.enabled ? 'enabled' : 'disabled'}`
          : 'No change',
        result.changed
          ? 'The change and its reason are recorded against this organization.'
          : `${capabilityLabel(result.capability)} was already ${result.enabled ? 'enabled' : 'disabled'}.`,
      );
      setPending(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['orgCapabilities', orgId] });
    },
    onError: (error) => notifyError(error, "Couldn't change the capability."),
  });

  const closeDialog = () => {
    if (setMutation.isPending) return;
    setPending(null);
    setReason('');
  };

  const statuses = data?.capabilities;
  const history = data?.history ?? [];
  const trimmedReason = reason.trim();
  const reasonValid = trimmedReason.length >= MIN_REASON_LENGTH;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Capabilities
        </CardTitle>
        <CardDescription>
          What this organization may do. Each change is recorded with the admin who made it and
          the reason given. Capabilities gate <strong>intake</strong> only — turning one off
          never affects cover already sold, and settlement is governed by the service tier, not
          by a capability.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {CAPABILITIES.map((capability) => (
              <div key={capability} className="flex items-center justify-between gap-4">
                <Skeleton className="h-10 w-full max-w-sm" />
                <Skeleton className="h-6 w-11 shrink-0" />
              </div>
            ))}
          </div>
        ) : isError || !statuses ? (
          <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p>
                We couldn't read this organization's capabilities, so none of the switches are
                shown. No change has been made.
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {statuses.map((entry) => (
              <CapabilityRow
                key={entry.capability}
                entry={entry}
                disabled={setMutation.isPending}
                onRequestChange={(enabled) => {
                  setReason('');
                  setPending({ capability: entry.capability, enabled });
                }}
              />
            ))}
          </ul>
        )}

        {history.length > 0 && (
          <div className="pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
            >
              <History className="mr-2 h-4 w-4" aria-hidden="true" />
              {showHistory ? 'Hide' : 'Show'} change history ({history.length})
            </Button>
            {showHistory && (
              <ul className="mt-3 space-y-3 text-sm">
                {history.map((change) => (
                  <li key={change.id} className="rounded-md border bg-muted/30 p-3">
                    <p className="font-medium">
                      {capabilityLabel(change.capability)}{' '}
                      <span className="font-normal text-muted-foreground">
                        {/*
                          fromEnabled === null means there was no grant row: the capability was
                          under IMPLICIT deny rather than explicitly switched off. Rendering that
                          as "off → on" would claim a decision nobody made.
                        */}
                        {change.fromEnabled === null
                          ? `never set → ${change.toEnabled ? 'on' : 'off'}`
                          : `${change.fromEnabled ? 'on' : 'off'} → ${change.toEnabled ? 'on' : 'off'}`}
                      </span>
                    </p>
                    <p className="mt-1 text-muted-foreground">{change.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(change.createdAt, 'MMM d, yyyy HH:mm')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.enabled ? 'Enable' : 'Disable'}{' '}
              {pending ? capabilityLabel(pending.capability) : ''}
            </DialogTitle>
            <DialogDescription>
              {pending?.enabled
                ? 'This organization will be able to use this immediately.'
                : 'This organization will stop being able to start this immediately. Cover already sold is unaffected.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="capability-reason">Reason</Label>
            <Textarea
              id="capability-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this changing? Recorded against the organization."
              rows={3}
              aria-describedby="capability-reason-hint"
            />
            <p id="capability-reason-hint" className="text-xs text-muted-foreground">
              At least {MIN_REASON_LENGTH} characters. Stored in the audit trail with your user
              id and the time.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={setMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant={pending?.enabled ? 'default' : 'destructive'}
              disabled={!reasonValid || setMutation.isPending || !pending}
              onClick={() => pending && setMutation.mutate(pending)}
            >
              {setMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {pending?.enabled ? 'Enable' : 'Disable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CapabilityRow({
  entry,
  disabled,
  onRequestChange,
}: {
  entry: OrgCapabilityAdminStatus;
  disabled: boolean;
  onRequestChange: (enabled: boolean) => void;
}) {
  const label = capabilityLabel(entry.capability);
  const description = isKnownCapability(entry.capability)
    ? CAPABILITY_DESCRIPTIONS[entry.capability]
    : // A capability the API knows and this build does not. Showing it as a toggle with no
      // description is better than hiding it: hiding it would make the list silently incomplete
      // on the one surface whose job is to show every switch.
      'This build does not recognise this capability. It may be newer than the dashboard.';
  const switchId = `capability-${entry.capability}`;

  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={switchId} className="text-sm font-medium">
            {label}
          </Label>
          {!entry.granted && (
            <Badge variant="outline" className="text-xs font-normal">
              never set
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {entry.reason && (
          <p className="mt-1 text-xs text-muted-foreground">
            Reason on file: {entry.reason}
            {entry.updatedAt ? ` · ${formatDate(entry.updatedAt, 'MMM d, yyyy')}` : ''}
          </p>
        )}
      </div>
      <Switch
        id={switchId}
        checked={entry.enabled}
        disabled={disabled}
        // Not optimistic: this only OPENS the reason dialog. The switch does not move until the
        // server has confirmed the change and the query has refetched.
        onCheckedChange={(next) => onRequestChange(next)}
        aria-describedby={undefined}
      />
    </li>
  );
}
