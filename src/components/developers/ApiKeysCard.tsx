import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Key, Copy, Check, RefreshCw, Ban, Loader2, AlertTriangle } from "lucide-react";
import type { ApiKeyRotateResult } from "@/types";

export function ApiKeysCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [newKeys, setNewKeys] = useState<ApiKeyRotateResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: keyStatus, isLoading, error } = useQuery({
    queryKey: ["api-key"],
    queryFn: () => api.getApiKey(),
    retry: 1,
  });

  // A 404 means the org has no key yet — treat as an empty state, not a hard error.
  const noKeyYet = error instanceof ApiError && error.status === 404;

  const rotateMutation = useMutation({
    mutationFn: () => api.rotateApiKey(),
    onSuccess: (result) => {
      setRotateConfirmOpen(false);
      setNewKeys(result);
      queryClient.invalidateQueries({ queryKey: ["api-key"] });
    },
    onError: (e: Error) => toast({ title: "Failed to rotate key", description: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.revokeApiKey(),
    onSuccess: (result) => {
      toast({ title: "API key revoked", description: "This key can no longer authenticate requests." });
      setRevokeConfirmOpen(false);
      queryClient.setQueryData(["api-key"], result);
    },
    onError: (e: Error) => toast({ title: "Failed to revoke key", description: e.message, variant: "destructive" }),
  });

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: `${field} copied` });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const closeNewKeys = () => {
    setNewKeys(null);
    setCopiedField(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Key className="h-4 w-4" /> API key
        </CardTitle>
        <CardDescription>
          Authenticate server-to-server requests with the <code className="rounded bg-muted px-1 py-0.5 text-xs">x-api-key</code> header.
          The full secret is shown only once, when you rotate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error && !noKeyYet ? (
          <p className="py-4 text-sm text-destructive">Could not load API key status. Try again later.</p>
        ) : noKeyYet || !keyStatus ? (
          <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-4">
            <p className="text-sm text-muted-foreground">No API key has been generated for your organization yet.</p>
            <Button onClick={() => setRotateConfirmOpen(true)} disabled={rotateMutation.isPending}>
              <Key className="mr-2 h-4 w-4" /> Generate API key
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Current key</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={keyStatus.masked} className="font-mono text-xs" />
                <StatusBadge variant={keyStatus.active ? "active" : "expired"}>
                  {keyStatus.active ? "Active" : "Revoked"}
                </StatusBadge>
              </div>
            </div>

            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(keyStatus.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Last rotated</p>
                <p className="font-medium">{keyStatus.rotatedAt ? formatDate(keyStatus.rotatedAt) : "Never"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button onClick={() => setRotateConfirmOpen(true)} disabled={rotateMutation.isPending}>
                <RefreshCw className="mr-2 h-4 w-4" /> Rotate key
              </Button>
              {keyStatus.active && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRevokeConfirmOpen(true)}
                  disabled={revokeMutation.isPending}
                >
                  <Ban className="mr-2 h-4 w-4" /> Revoke
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Rotate confirm */}
      <Dialog open={rotateConfirmOpen} onOpenChange={setRotateConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rotate API key?</DialogTitle>
            <DialogDescription>
              This immediately invalidates the current key. Any integrations using it will stop working until updated
              with the new credentials.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => rotateMutation.mutate()} disabled={rotateMutation.isPending}>
              {rotateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rotate key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <Dialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke API key?</DialogTitle>
            <DialogDescription>
              The key stops authenticating requests immediately. You can generate a new one later by rotating.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeMutation.mutate()}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time credentials reveal */}
      <Dialog open={newKeys !== null} onOpenChange={(o) => !o && closeNewKeys()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your new API credentials</DialogTitle>
            <DialogDescription className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Copy these now. For your security, the secret will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {newKeys && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API key</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={newKeys.apiKey} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" aria-label="Copy API key" onClick={() => copy(newKeys.apiKey, "API key")}>
                    {copiedField === "API key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>API secret</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={newKeys.apiSecret} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" aria-label="Copy API secret" onClick={() => copy(newKeys.apiSecret, "API secret")}>
                    {copiedField === "API secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={closeNewKeys}>I've saved my credentials</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
