import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Key, Webhook, Users, FileText, AlertTriangle, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";

// Code Snippets as constants to prevent template literal compilation issues
const curlExample = `curl -X GET "https://api.microcrop.app/api/organizations/me" \\
  -H "x-api-key: sk_live_YOUR_API_KEY_HERE" \\
  -H "Content-Type: application/json"`;

const farmerRequestJson = `{
  "phoneNumber": "+254712345678",
  "nationalId": "12345678",
  "firstName": "James",
  "lastName": "Mwangi",
  "county": "Nakuru",
  "subCounty": "Njoro",
  "ward": "Mau Narok",
  "village": "Elburgon"
}`;

const farmerResponseJson = `{
  "success": true,
  "data": {
    "id": "f_12345abcd",
    "phoneNumber": "+254712345678",
    "nationalId": "12345678",
    "kycStatus": "PENDING",
    "createdAt": "2026-06-06T12:00:00Z"
  }
}`;

const quoteRequestJson = `{
  "farmerId": "f_12345abcd",
  "plotId": "p_98765xyz",
  "sumInsured": 50000,
  "coverageType": "DROUGHT",
  "durationDays": 90
}`;

const quoteResponseJson = `{
  "success": true,
  "data": {
    "sumInsured": 50000,
    "premium": 2500.00,
    "platformFee": 125.00,
    "netPremium": 2375.00,
    "coverageType": "DROUGHT",
    "durationDays": 90,
    "breakdown": {
      "baseRate": 0.04,
      "cropFactor": 1.0,
      "durationFactor": 1.25,
      "calculation": "50000 * 0.04 * 1.0 * 1.25"
    }
  }
}`;

const purchaseResponseJson = `{
  "success": true,
  "data": {
    "policy": {
      "id": "pol_xyz789",
      "policyNumber": "POL-2026-A1B2C3D4",
      "status": "PENDING",
      "premium": 2500.00,
      "netPremium": 2375.00,
      "platformFee": 125.00,
      "sumInsured": 50000,
      "coverageType": "DROUGHT",
      "durationDays": 90,
      "startDate": "2026-06-06T22:30:00.000Z",
      "endDate": "2026-09-04T22:30:00.000Z"
    },
    "paymentInstructions": {
      "amount": 2500.00,
      "policyNumber": "POL-2026-A1B2C3D4",
      "message": "Pay KES 2500.00 for policy POL-2026-A1B2C3D4"
    }
  }
}`;

const activateResponseJson = `{
  "success": true,
  "data": {
    "id": "pol_xyz789",
    "status": "ACTIVE",
    "activatedAt": "2026-06-06T22:45:00.000Z"
  }
}`;

const webhookPayloadJson = `{
  "id": "evt_123456789",
  "event": "payout.executed",
  "created_at": "2026-08-15T14:30:00Z",
  "data": {
    "policyId": "pol_xyz789",
    "policyNumber": "POL-2026-A1B2C3D4",
    "farmerId": "f_12345abcd",
    "farmerPhone": "+254712345678",
    "payoutAmount": 50000.00,
    "currency": "KES",
    "triggerType": "DROUGHT_NDVI_THRESHOLD",
    "transactionHash": "0x123abc...",
    "settlementProvider": "MPESA"
  }
}`;

const errorResponseJson = `{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid farmer parameters provided",
    "details": [
      {
        "field": "phoneNumber",
        "message": "Must be a valid E.164 phone number"
      }
    ]
  }
}`;

// UI Component Helpers for Structured Parameters
const ParamRow = ({ name, type, required, description }: { name: string; type: string; required: boolean; description: string }) => (
  <div className="flex flex-col sm:flex-row sm:items-start border-b py-3 text-sm last:border-0">
    <div className="sm:w-1/3 pr-4 mb-1 sm:mb-0">
      <span className="font-mono text-emerald-600 font-semibold">{name}</span>
      <span className="text-[10px] uppercase font-bold text-muted-foreground ml-2 px-1.5 py-0.5 bg-muted rounded">
        {type}
      </span>
      {required && (
        <span className="text-[10px] uppercase font-bold text-red-500 ml-1.5">
          Required
        </span>
      )}
    </div>
    <div className="sm:w-2/3 text-muted-foreground">
      {description}
    </div>
  </div>
);

const ErrorRow = ({ status, code, description }: { status: string; code: string; description: string }) => (
  <div className="flex flex-col sm:flex-row sm:items-start border-b py-3 text-sm last:border-0">
    <div className="sm:w-1/3 pr-4 mb-1 sm:mb-0">
      <span className="font-mono text-red-600 font-semibold">{status}</span>
      <span className="text-[10px] uppercase font-bold text-muted-foreground ml-2 px-1.5 py-0.5 bg-muted rounded">
        {code}
      </span>
    </div>
    <div className="sm:w-2/3 text-muted-foreground">
      {description}
    </div>
  </div>
);

const EventRow = ({ name, description }: { name: string; description: string }) => (
  <div className="flex flex-col sm:flex-row sm:items-start border-b py-3 text-sm last:border-0">
    <div className="sm:w-1/3 pr-4 mb-1 sm:mb-0">
      <span className="font-mono text-blue-600 font-semibold">{name}</span>
    </div>
    <div className="sm:w-2/3 text-muted-foreground">
      {description}
    </div>
  </div>
);

export default function DocsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard.`,
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const CodeBlock = ({ code }: { code: string }) => (
    <div className="relative group">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="secondary" size="icon" className="h-6 w-6" onClick={() => handleCopy(code, "Code snippet")}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <pre className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-x-auto text-xs font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );

  return (
    <div className="container mx-auto py-12 max-w-5xl space-y-8 px-4 font-sans">
      <div className="space-y-4">
        <div className="flex items-center gap-4 border-b pb-6">
          <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 shadow-sm">
            <img src="/microcropsymb.png" alt="MicroCrop Logo" className="h-10 w-10 object-contain drop-shadow-md" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent font-display">
              MicroCrop API Reference
            </h1>
            <p className="text-sm font-medium text-emerald-600/80 mt-1 uppercase tracking-wider font-mono">
              B2B Integration Guide
            </p>
          </div>
        </div>
        <p className="text-base text-muted-foreground max-w-3xl leading-relaxed">
          Integrate MicroCrop's parametric crop and livestock insurance capabilities into your platform. Use these endpoints to register farmers, request pricing, purchase coverage policies, and process automated mobile money claim payouts triggered by oracle climate data.
        </p>
        
        <div className="flex flex-wrap gap-4 pt-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Production</Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">https://api.microcrop.app/api</code>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Sandbox</Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">https://sandbox.api.microcrop.app/api</code>
          </div>
        </div>
      </div>

      <Tabs defaultValue="auth" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-12">
          <TabsTrigger value="auth" className="flex items-center gap-2 text-sm"><Key className="h-4 w-4" /> Auth</TabsTrigger>
          <TabsTrigger value="farmers" className="flex items-center gap-2 text-sm"><Users className="h-4 w-4" /> Farmers</TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4" /> Policies</TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2 text-sm"><Webhook className="h-4 w-4" /> Webhooks</TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4" /> Errors</TabsTrigger>
        </TabsList>

        {/* AUTHENTICATION TAB */}
        <TabsContent value="auth" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>
                Authenticate server-to-server API requests using custom headers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Organizations use two types of keys for API access. The public key is safe for client-side configurations. The secret key is for server-side requests and must not be exposed.
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Public Key</label>
                  <div className="flex gap-2">
                    <Input value={`org_live_${user?.organizationId || "demo123"}`} readOnly className="font-mono text-xs bg-muted/50" />
                    <Button variant="outline" size="icon" onClick={() => handleCopy(`org_live_${user?.organizationId || "demo123"}`, "Public Key")}>
                      {copiedKey === "Public Key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Used to identify your organization in public or frontend interfaces.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Secret Key</label>
                  <div className="rounded-md border border-dashed p-3 bg-muted/30 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Your secret key is shown only once, when you generate or rotate it. Pass it inside the <code>x-api-key</code> header and keep it secure.
                    </p>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/org/developers?tab=api-keys">
                        <Key className="mr-2 h-4 w-4" /> Manage API keys
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <h3 className="text-sm font-semibold">Example Request</h3>
                <CodeBlock code={curlExample} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FARMERS TAB */}
        <TabsContent value="farmers" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Register Farmer</CardTitle>
                  <CardDescription>Creates a new farmer profile under your organization.</CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">POST /api/farmers/register</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Creates a farmer record. A registered farmer profile is required before policies can be issued. The phone number provided serves as the destination for automated mobile money claim payouts.
                </p>
                <div className="space-y-1">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Request Body</h4>
                  <div className="border rounded-md px-4 py-2 bg-slate-50/50">
                    <ParamRow name="phoneNumber" type="string" required={true} description="E.164 formatted number (e.g. +254712345678) for payout routing." />
                    <ParamRow name="nationalId" type="string" required={true} description="National Identification number. Must be unique." />
                    <ParamRow name="firstName" type="string" required={true} description="Legal first name." />
                    <ParamRow name="lastName" type="string" required={true} description="Legal last name." />
                    <ParamRow name="county" type="string" required={true} description="Administrative county (e.g. Nakuru)." />
                    <ParamRow name="subCounty" type="string" required={false} description="Sub-county location." />
                    <ParamRow name="ward" type="string" required={false} description="Ward location." />
                    <ParamRow name="village" type="string" required={false} description="Village location." />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Payload Example</h4>
                  <CodeBlock code={farmerRequestJson} />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Response (201 Created)</h4>
                  <CodeBlock code={farmerResponseJson} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POLICIES TAB */}
        <TabsContent value="policies" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Calculate Quote</CardTitle>
                  <CardDescription>Retrieve pricing quotes based on risk parameters.</CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">POST /api/policies/quote</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Generates premium price estimates based on the sum insured, coverage type, duration, and regional factors. Sending a quote request does not create a policy.
                </p>
                <div className="space-y-1">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Request Body</h4>
                  <div className="border rounded-md px-4 py-2 bg-slate-50/50">
                    <ParamRow name="farmerId" type="string" required={true} description="Unique ID of the registered farmer." />
                    <ParamRow name="plotId" type="string" required={false} description="Target farm plot identifier." />
                    <ParamRow name="sumInsured" type="number" required={true} description="Maximum liability settlement payout (KES)." />
                    <ParamRow name="coverageType" type="string" required={true} description="Risk profile: DROUGHT, FLOOD, or BOTH." />
                    <ParamRow name="durationDays" type="number" required={true} description="Coverage timeline length in days (30 to 365)." />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Payload Example</h4>
                  <CodeBlock code={quoteRequestJson} />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Response (200 OK)</h4>
                  <CodeBlock code={quoteResponseJson} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Create Policy</CardTitle>
                  <CardDescription>Register a new policy under a farmer's profile.</CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">POST /api/policies/purchase</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Generates and registers a policy. Newly created policies start in a PENDING status and will not trigger claims until they are activated. Use the activation endpoint to transition policies to an active status after premium payment.
                </p>
                <div className="space-y-1">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Request Body</h4>
                  <p className="text-xs text-muted-foreground mb-2">Matches the parameters defined in the quoting endpoint.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Response (201 Created)</h4>
                  <CodeBlock code={purchaseResponseJson} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activate Policy</CardTitle>
                  <CardDescription>Activate a pending policy once payment is complete.</CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">PUT /api/policies/:policyId/activate</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Transitions a pending policy to active. Run this request after confirming premium settlement. Active policies monitor climate parameters via network oracles to initiate automated payouts.
                </p>
                <div className="space-y-1">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">URL Parameters</h4>
                  <div className="border rounded-md px-4 py-2 bg-slate-50/50">
                    <ParamRow name="policyId" type="string" required={true} description="Unique ID of the policy to activate." />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Response (200 OK)</h4>
                  <CodeBlock code={activateResponseJson} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WEBHOOKS TAB */}
        <TabsContent value="webhooks" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Notifications</CardTitle>
              <CardDescription>
                Receive asynchronous event payload notifications from the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                MicroCrop uses webhooks to notify external systems when state changes occur asynchronously, such as oracle validation events and mobile money claim executions. Configure your endpoint URL and signing secret, and review delivery attempts, in the Developers settings panel.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/org/developers?tab=webhooks">
                  <Webhook className="mr-2 h-4 w-4" /> Configure webhooks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Event Types Supported</h4>
                <div className="border rounded-md px-4 py-2 bg-slate-50/50">
                  <EventRow name="payout.executed" description="A claim payout was successfully processed and sent to the farmer's mobile money wallet." />
                  <EventRow name="policy.activated" description="A pending policy premium payment was verified and coverage has begun." />
                  <EventRow name="policy.expired" description="A policy's active term has completed without triggering a climate claim." />
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <h3 className="text-sm font-semibold">Webhook Signature Verification</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Each webhook request includes an <code>x-microcrop-signature</code> header. Verify the payload integrity by computing the HMAC SHA-256 signature of the raw request body using your Webhook Secret key, then check that it matches the header value.
                </p>
              </div>

              <div className="pt-4 border-t space-y-3">
                <h3 className="text-sm font-semibold">Example Payload (payout.executed)</h3>
                <CodeBlock code={webhookPayloadJson} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ERRORS TAB */}
        <TabsContent value="errors" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Error Handling</CardTitle>
              <CardDescription>Standardized HTTP status responses and error structures.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                The API communicates endpoint request failures using standard HTTP status codes combined with descriptive JSON payloads.
              </p>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">HTTP Status Codes</h4>
                  <div className="border rounded-md px-4 py-2 bg-slate-50/50">
                    <ErrorRow status="400" code="VALIDATION_ERROR" description="Request body contains missing or invalid parameters." />
                    <ErrorRow status="401" code="UNAUTHORIZED" description="Missing, invalid, or expired API secret key header." />
                    <ErrorRow status="403" code="FORBIDDEN" description="Credentials do not have permission for the requested resource." />
                    <ErrorRow status="404" code="NOT_FOUND" description="The requested path or resource ID does not exist." />
                    <ErrorRow status="409" code="CONFLICT" description="Action conflicts with database state (e.g. duplicate identifier)." />
                    <ErrorRow status="429" code="RATE_LIMITED" description="API rate limit has been exceeded for this token." />
                    <ErrorRow status="500" code="INTERNAL_ERROR" description="An unexpected error occurred within our service infrastructure." />
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Error Payload Example</h4>
                  <CodeBlock code={errorResponseJson} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
