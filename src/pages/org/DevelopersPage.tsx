/**
 * DEVELOPERS — API credentials and the webhook endpoint.
 *
 * BOTH TABS ARE CAPABILITY-GATED, and they are gated SEPARATELY because the backend gates them
 * separately: `PARTNER_API_ACCESS` is checked in the `x-api-key` branch of auth.middleware, and
 * `PARTNER_WEBHOOKS` in `webhook.service.emitWebhook` / `retryWebhookDelivery`. A partner can
 * legitimately have one and not the other.
 *
 * WHY THE GATE IS NOT ON THE ROUTE. The credentials UI itself still WORKS without the
 * capability — a key can be read and rotated — it just authenticates nothing, and the webhook URL
 * can be saved but nothing is ever delivered to it. Hiding the page would leave a partner with no
 * way to find out why its integration receives nothing; replacing the TAB CONTENT says it in the
 * one place the partner is looking.
 *
 * The gate reads a single shared `['my-capabilities']` query, so both tabs resolve at the same
 * moment rather than settling in stages.
 */
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Webhook } from "lucide-react";
import { ApiKeysCard } from "@/components/developers/ApiKeysCard";
import { WebhooksCard } from "@/components/developers/WebhooksCard";
import { CapabilityGate } from "@/components/capability/CapabilityGate";
import { useCapabilities } from "@/hooks/useCapabilities";
import { CAPABILITY } from "@/lib/capability";

export default function DevelopersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "webhooks" ? "webhooks" : "api-keys";
  const { stateOf, refetch } = useCapabilities();

  const setTab = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", value);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Developers</h1>
        <p className="text-muted-foreground">
          Manage the API credentials and webhook endpoint your integration uses.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="api-keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" aria-hidden="true" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" aria-hidden="true" /> Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="mt-6">
          <CapabilityGate
            capability={CAPABILITY.PARTNER_API_ACCESS}
            state={stateOf(CAPABILITY.PARTNER_API_ACCESS)}
            onRetry={refetch}
          >
            <ApiKeysCard />
          </CapabilityGate>
        </TabsContent>
        <TabsContent value="webhooks" className="mt-6">
          <CapabilityGate
            capability={CAPABILITY.PARTNER_WEBHOOKS}
            state={stateOf(CAPABILITY.PARTNER_WEBHOOKS)}
            onRetry={refetch}
          >
            <WebhooksCard />
          </CapabilityGate>
        </TabsContent>
      </Tabs>
    </div>
  );
}
