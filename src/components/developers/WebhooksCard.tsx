import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Webhook,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import type { WebhookDeliveryStatus } from "@/types";

const PAGE_SIZE = 20;

const statusVariant = (status: WebhookDeliveryStatus) => {
  switch (status) {
    case "DELIVERED":
      return "completed" as const;
    case "FAILED":
      return "failed" as const;
    default:
      return "pending" as const;
  }
};

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export function WebhooksCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [urlInput, setUrlInput] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | WebhookDeliveryStatus>("ALL");
  const [page, setPage] = useState(1);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["webhook-config"],
    queryFn: () => api.getWebhookConfig(),
    retry: 1,
  });

  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ["webhook-deliveries", statusFilter, page],
    queryFn: () =>
      api.getWebhookDeliveries({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        page,
        limit: PAGE_SIZE,
      }),
    retry: 1,
  });

  const urlValue = urlInput ?? config?.url ?? "";
  const urlDirty = urlInput !== null && urlInput !== (config?.url ?? "");
  const urlValid = urlValue.length === 0 || isHttpsUrl(urlValue);

  const saveUrlMutation = useMutation({
    mutationFn: (url: string) => api.setWebhookConfig(url),
    onSuccess: (result) => {
      toast({ title: "Webhook endpoint saved", description: result.url ?? undefined });
      setUrlInput(null);
      queryClient.setQueryData(["webhook-config"], result);
    },
    onError: (e: Error) => toast({ title: "Failed to save endpoint", description: e.message, variant: "destructive" }),
  });

  const rotateSecretMutation = useMutation({
    mutationFn: () => api.rotateWebhookSecret(),
    onSuccess: (result) => {
      toast({ title: "Signing secret rotated", description: "Update your endpoint with the new secret." });
      setRotateOpen(false);
      setRevealSecret(true);
      queryClient.setQueryData(["webhook-config"], (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        return { ...(prev as Record<string, unknown>), secret: result.secret, secretSet: true };
      });
      queryClient.invalidateQueries({ queryKey: ["webhook-config"] });
    },
    onError: (e: Error) => toast({ title: "Failed to rotate secret", description: e.message, variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.retryWebhookDelivery(id),
    onSuccess: () => {
      toast({ title: "Delivery re-queued" });
      queryClient.invalidateQueries({ queryKey: ["webhook-deliveries"] });
    },
    onError: (e: Error) => toast({ title: "Retry failed", description: e.message, variant: "destructive" }),
  });

  const onSaveUrl = () => {
    if (!urlValid || urlValue.length === 0) {
      toast({ title: "Enter a valid https:// URL", variant: "destructive" });
      return;
    }
    saveUrlMutation.mutate(urlValue);
  };

  const copySecret = () => {
    if (!config?.secret) return;
    navigator.clipboard.writeText(config.secret);
    setCopied(true);
    toast({ title: "Signing secret copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const deliveries = deliveriesData?.deliveries ?? [];
  const total = deliveriesData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Endpoint URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> Endpoint
          </CardTitle>
          <CardDescription>
            We POST event notifications to this HTTPS URL. Verify each request using the signing secret below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {configLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="webhook-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://example.com/webhooks/microcrop"
                    value={urlValue}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className={!urlValid ? "border-destructive" : undefined}
                  />
                  <Button onClick={onSaveUrl} disabled={!urlDirty || !urlValid || saveUrlMutation.isPending}>
                    {saveUrlMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
                {!urlValid && <p className="text-xs text-destructive">Must be a valid https:// URL.</p>}
              </div>

              {/* Signing secret */}
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <Label>Signing secret</Label>
                  {config?.secretSet ? (
                    <StatusBadge variant="success">Set</StatusBadge>
                  ) : (
                    <StatusBadge variant="warning">Not set</StatusBadge>
                  )}
                </div>
                {config?.secretSet ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      value={revealSecret && config.secret ? config.secret : "••••••••••••••••••••••••"}
                      className="font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setRevealSecret((v) => !v)}
                        aria-label={revealSecret ? "Hide secret" : "Reveal secret"}
                        disabled={!config.secret}
                      >
                        {revealSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copySecret}
                        aria-label="Copy secret"
                        disabled={!config.secret}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" onClick={() => setRotateOpen(true)}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Rotate
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Generate a signing secret to verify webhook authenticity.
                    </p>
                    <Button variant="outline" onClick={() => setRotateOpen(true)}>
                      <KeyRound className="mr-2 h-4 w-4" /> Generate secret
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Deliveries */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Delivery log</CardTitle>
            <CardDescription>Recent webhook delivery attempts. Retry any that failed.</CardDescription>
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as "ALL" | WebhookDeliveryStatus);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="DELIVERED">Delivered</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {deliveriesLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : deliveries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No webhook deliveries yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last error</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.event}</TableCell>
                      <TableCell>
                        <StatusBadge variant={statusVariant(d.status)}>{d.status}</StatusBadge>
                      </TableCell>
                      <TableCell>{d.attempts}</TableCell>
                      <TableCell>{d.responseStatus ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(d.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={d.lastError ?? undefined}>
                        {d.lastError ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.status === "FAILED" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryMutation.mutate(d.id)}
                            disabled={retryMutation.isPending && retryMutation.variables === d.id}
                          >
                            {retryMutation.isPending && retryMutation.variables === d.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            )}
                            Retry
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {total} total
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Rotate secret confirm */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{config?.secretSet ? "Rotate signing secret?" : "Generate signing secret?"}</DialogTitle>
            <DialogDescription>
              {config?.secretSet
                ? "The current secret stops working immediately. Update your endpoint with the new secret to keep verifying webhooks."
                : "This creates a new signing secret you can use to verify incoming webhook requests."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => rotateSecretMutation.mutate()} disabled={rotateSecretMutation.isPending}>
              {rotateSecretMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {config?.secretSet ? "Rotate secret" : "Generate secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
