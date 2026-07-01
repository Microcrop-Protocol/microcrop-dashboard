import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Webhook } from "lucide-react";
import { ApiKeysCard } from "@/components/developers/ApiKeysCard";
import { WebhooksCard } from "@/components/developers/WebhooksCard";

export default function DevelopersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "webhooks" ? "webhooks" : "api-keys";

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
            <Key className="h-4 w-4" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysCard />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-6">
          <WebhooksCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
