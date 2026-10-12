import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { Loader2, Smartphone } from "lucide-react";
import { notifySuccess, notifyError } from "@/lib/notify";
import { KybGatingBanner } from "@/components/kyb/KybGatingBanner";
import { CapabilityGate } from "@/components/capability/CapabilityGate";
import { useCapability } from "@/hooks/useCapabilities";
import { CAPABILITY } from "@/lib/capability";
import { useOrgMarket } from "@/hooks/useOrgMarket";
import { formatMoney as formatMarketMoney, withCurrencySuffix } from "@/lib/market";
import { useCatalogue } from "@/hooks/useCatalogue";
import {
  findCatalogueItem,
  notSellableReason,
  productLabel,
  soldUnderLabel,
} from "@/lib/catalogue";
import { getErrorMessage } from "@/lib/error-messages";
import {
  CatalogueItemDetails,
  CatalogueStatusBadge,
  CatalogueUnknownNote,
} from "@/components/catalogue/CatalogueOptions";
import type { Farmer, Plot, CoverageType, Policy, PaymentInstructions } from "@/types";

const STEP_TITLES = ["Configure Policy", "Review & Create", "Collect Premium"];

export default function NewPolicyPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = user?.organizationId || "";
  const cropUnderwriting = useCapability(CAPABILITY.CROP_UNDERWRITING);
  // The organization's currency and the local name for the mobile-money prompt. `market` is null
  // while it resolves or if the country is unrecognised, and formatMoney then renders the number
  // with NO currency rather than asserting KES over a Ghanaian partner's premiums.
  const { market, mobileMoneyLabel } = useOrgMarket();
  // The market's product catalogue decides which plots can be quoted here: a plot whose crop is
  // coming soon, or a legacy crop the market never listed, stays registered but cannot be sold.
  const catalogue = useCatalogue();

  /**
   * Render a money field without assuming the API sent it, and without assuming it arrived as a
   * number — Prisma Decimals serialize to strings on the wire.
   */
  const formatMoney = (value: number | string | null | undefined): string => {
    const amount = Number(value);
    if (value == null || !Number.isFinite(amount)) return market ? `${market.currency} —` : "—";
    return formatMarketMoney(amount, market);
  };

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    farmerId: "",
    plotId: "",
    sumInsured: 100000,
    coverageType: "BOTH",
    duration: 180,
  });
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions | null>(null);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentRef, setPaymentRef] = useState<string | null>(null);

  const { data: farmersData } = useQuery({
    queryKey: ["farmers", orgId],
    queryFn: () => api.getFarmers(orgId),
    enabled: !!orgId,
  });

  const { data: plotsData } = useQuery({
    queryKey: ["plots", orgId],
    queryFn: () => api.getPlots(orgId),
    enabled: !!orgId,
  });

  const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object') {
      const maybeData = (value as { data?: unknown }).data;
      if (Array.isArray(maybeData)) return maybeData as T[];
    }
    return [];
  };

  const farmers = toArray<Farmer>(farmersData?.data);
  const plots = toArray<Plot>(plotsData?.data);

  const approvedFarmers = farmers.filter((f) => f.kycStatus === 'APPROVED');
  const farmerPlots = plots.filter((p) => p.farmerId === formData.farmerId);
  const selectedFarmer = farmers.find((f) => f.id === formData.farmerId);
  const selectedPlot = farmerPlots.find((p) => p.id === formData.plotId);
  const selectedCrop = findCatalogueItem(catalogue.market, "CROP", selectedPlot?.cropType);
  // Null while the catalogue is not known — the quote below then waits rather than guessing.
  const cropReason = notSellableReason(catalogue.market, "CROP", selectedPlot?.cropType);
  const cropSellable = catalogue.state === "known" && Boolean(selectedPlot) && !cropReason;

  // Fetch a real premium quote from the pricing endpoint once the policy is
  // configured. We never present a fabricated figure as the quote.
  const { data: quote, isFetching: quoteLoading, error: quoteError } = useQuery({
    queryKey: [
      "policy-quote",
      formData.farmerId,
      formData.plotId,
      formData.sumInsured,
      formData.coverageType,
      formData.duration,
    ],
    queryFn: () =>
      api.getPolicyQuote({
        farmerId: formData.farmerId,
        plotId: formData.plotId,
        sumInsured: formData.sumInsured,
        coverageType: formData.coverageType as CoverageType,
        durationDays: formData.duration,
      }),
    // Only for a crop the market SELLS. Quoting a coming-soon crop is a refusal we can predict,
    // and it is said beside the plot picker instead of as a failed request.
    enabled: !!formData.farmerId && !!formData.plotId && formData.sumInsured > 0 && cropSellable,
    // A catalogue refusal (PRODUCT_NOT_OFFERED, PRICING_NOT_CONFIGURED) will not change on retry.
    retry: false,
  });

  const premium = quote?.premium ?? null;
  const fee = quote?.platformFee ?? null;
  const total = quote?.totalCost ?? null;

  // `/policies/purchase` creates the policy PENDING and unpaid — it does NOT
  // activate it. Activation happens only after the farmer confirms the mobile-money
  // prompt and the payment webhook lands, so this page must never report
  // activation here; it reports the real status and then collects the premium.
  const purchaseMutation = useMutation({
    mutationFn: () =>
      api.purchasePolicy({
        farmerId: formData.farmerId,
        plotId: formData.plotId,
        sumInsured: formData.sumInsured,
        coverageType: formData.coverageType as "DROUGHT" | "FLOOD" | "BOTH" | "COMPREHENSIVE",
        durationDays: formData.duration,
      }),
    onSuccess: (result) => {
      setPolicy(result.policy);
      setPaymentInstructions(result.paymentInstructions ?? null);
      setPaymentPhone(selectedFarmer?.phoneNumber ?? "");
      setStep(3);
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      notifySuccess(
        "Policy created",
        `Policy ${result.policy.policyNumber} is awaiting premium payment.`,
      );
    },
    onError: (error) => {
      notifyError(error, "Couldn't create the policy. Please try again.");
    },
  });

  // The premium the STK push must charge. Prefer what the backend told us to
  // collect; fall back to the quote total. `Number()` because the backend sends
  // `policy.premium`, a Prisma Decimal, which serializes to a string.
  const parsedAmountDue = Number(paymentInstructions?.amount ?? total);
  const amountDue =
    Number.isFinite(parsedAmountDue) && parsedAmountDue > 0 ? parsedAmountDue : null;

  const paymentMutation = useMutation({
    mutationFn: () => {
      if (!policy) throw new Error("No policy created");
      if (amountDue == null) {
        throw new Error("Premium amount unavailable — open the policy to collect payment");
      }
      return api.initiatePayment({
        policyId: policy.id,
        amount: amountDue,
        phoneNumber: paymentPhone.trim(),
      });
    },
    onSuccess: (result) => {
      setPaymentRef(result.reference);
      // The backend's replay guard returns the EXISTING transaction without pushing
      // a second STK prompt. Reporting "sent" there invites the operator to keep
      // clicking, and duplicate premium is not refunded anywhere in this system.
      if (result.alreadyPending) {
        notifySuccess("Payment prompt already pending", result.instructions);
      } else {
        notifySuccess(
          "Payment request sent",
          `Check the farmer's phone for the ${mobileMoneyLabel} prompt.`,
        );
      }
    },
    onError: (error) => {
      notifyError(error, "Couldn't send the payment request.");
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Policy</h1>
        <p className="text-muted-foreground">
          Step {step} of 3: {STEP_TITLES[step - 1]}
        </p>
      </div>

      <KybGatingBanner feature="Creating policies" />

      {/*
        CROP_UNDERWRITING gates quote AND purchase inside policy.service, so without it every
        control on this page leads to a 403 — the quote request included. The whole flow is
        replaced rather than the Create button disabled: a partner stepping through three screens
        to be refused at the end is strictly worse than being told up front.

        It is deliberately ONE gate for the three steps. Steps 2 and 3 are only reachable through
        step 1, and re-gating each would add two more places for the loading branch to be
        forgotten.
      */}
      <CapabilityGate
        capability={CAPABILITY.CROP_UNDERWRITING}
        state={cropUnderwriting.state}
        onRetry={cropUnderwriting.refetch}
      >
      {step === 1 ? (
        <Card>
          <CardHeader><CardTitle>Policy Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Farmer</Label>
              <Select
                value={formData.farmerId}
                onValueChange={(v) => setFormData((p) => ({ ...p, farmerId: v, plotId: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
                <SelectContent>
                  {approvedFarmers.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.firstName} {f.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Plot</Label>
              <Select
                value={formData.plotId}
                onValueChange={(v) => setFormData((p) => ({ ...p, plotId: v }))}
                disabled={!formData.farmerId}
              >
                <SelectTrigger><SelectValue placeholder="Select plot" /></SelectTrigger>
                <SelectContent>
                  {farmerPlots.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {productLabel(catalogue.market, "CROP", p.cropType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPlot && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Crop:</span>
                    <span>{productLabel(catalogue.market, "CROP", selectedPlot.cropType)}</span>
                    <CatalogueStatusBadge status={selectedCrop?.status} />
                  </div>
                  {cropReason ? (
                    <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{cropReason}</p>
                  ) : (
                    <CatalogueItemDetails
                      item={selectedCrop}
                      countryName={catalogue.market?.countryName ?? ""}
                    />
                  )}
                </div>
              )}
              {catalogue.state === "unknown" && (
                <CatalogueUnknownNote className="mt-2" onRetry={catalogue.refetch} />
              )}
            </div>

            <div>
              <Label>{withCurrencySuffix("Sum Insured", market)}</Label>
              <Input
                type="number"
                value={formData.sumInsured}
                onChange={(e) => setFormData((p) => ({ ...p, sumInsured: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <Label>Coverage Type</Label>
              <Select
                value={formData.coverageType}
                onValueChange={(v) => setFormData((p) => ({ ...p, coverageType: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DROUGHT">Drought</SelectItem>
                  <SelectItem value="FLOOD">Flood</SelectItem>
                  <SelectItem value="BOTH">Both (Drought &amp; Flood)</SelectItem>
                  <SelectItem value="COMPREHENSIVE">Comprehensive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Duration: {formData.duration} days</Label>
              <Slider
                value={[formData.duration]}
                onValueChange={(v) => setFormData((p) => ({ ...p, duration: v[0] }))}
                min={30}
                max={365}
                step={30}
              />
            </div>

            <div className="rounded-lg bg-muted p-4">
              {quoteLoading ? (
                <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating quote…
                </div>
              ) : premium != null && fee != null ? (
                <>
                  <div className="flex justify-between">
                    <span>Premium</span>
                    <span>{formatMoney(premium)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Platform Fee</span>
                    <span>{formatMoney(fee)}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t pt-2 font-bold">
                    <span>Total</span>
                    <span>{formatMoney(total ?? premium)}</span>
                  </div>
                </>
              ) : quoteError ? (
                <p role="alert" className="text-sm text-destructive">
                  {getErrorMessage(quoteError, "Couldn't calculate a quote for this plot.")}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {cropReason
                    ? "This plot's crop can't be quoted in your market."
                    : "Select a farmer and plot to calculate the premium quote."}
                </p>
              )}
            </div>

            <Button
              onClick={() => setStep(2)}
              className="w-full"
              disabled={!formData.farmerId || !formData.plotId || !cropSellable}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      ) : step === 2 ? (
        <Card>
          <CardHeader><CardTitle>Review &amp; Create</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {total != null
                ? `Premium due: ${formatMoney(total)}.`
                : "The premium will be confirmed when the policy is created."}
            </p>
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              <p>
                Creating the policy does <strong>not</strong> activate it. The policy is
                recorded as <strong>pending</strong> until the premium is paid. On the next
                step you can send the {mobileMoneyLabel} prompt to
                {selectedFarmer ? ` ${selectedFarmer.firstName} ${selectedFarmer.lastName}` : " the farmer"}
                {selectedFarmer?.phoneNumber ? ` (${selectedFarmer.phoneNumber})` : ""}; the policy
                activates only once that payment is confirmed.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} disabled={purchaseMutation.isPending}>Back</Button>
              <Button className="flex-1" onClick={() => purchaseMutation.mutate()} disabled={purchaseMutation.isPending || !cropSellable}>
                {purchaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Policy
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Collect Premium</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
              <div>
                <p className="font-medium">{policy?.policyNumber ?? "Policy created"}</p>
                {soldUnderLabel(policy?.catalogueStatus) && (
                  <p className="text-xs text-muted-foreground">
                    Sold as: {soldUnderLabel(policy?.catalogueStatus)}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {paymentInstructions?.message ??
                    "Please complete premium payment to activate this policy."}
                </p>
              </div>
              {policy?.status && (
                <StatusBadge variant={getStatusVariant(policy.status)}>{policy.status}</StatusBadge>
              )}
            </div>

            <div className="flex justify-between rounded-lg bg-muted p-4 font-bold">
              <span>Amount due</span>
              <span>{formatMoney(amountDue)}</span>
            </div>

            {paymentRef ? (
              <div className="space-y-3">
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  <p>
                    A {mobileMoneyLabel} prompt was sent to <strong>{paymentPhone}</strong>. The policy stays
                    <strong> pending</strong> until the farmer approves it on their phone — it is not
                    active yet. Refresh the policy from the policies list to see the confirmed status.
                  </p>
                  <p className="mt-2 font-mono text-xs">Reference: {paymentRef}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => paymentMutation.mutate()}
                    disabled={paymentMutation.isPending}
                  >
                    {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Resend prompt
                  </Button>
                  <Button className="flex-1" onClick={() => navigate("/org/policies")}>
                    Go to policies
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="payment-phone">Farmer&apos;s {mobileMoneyLabel} number</Label>
                  <Input
                    id="payment-phone"
                    type="tel"
                    placeholder={market?.phoneExample ?? ""}
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                  />
                </div>
                {amountDue == null && (
                  <p className="text-sm text-destructive">
                    The premium amount is unavailable, so no payment request can be sent. Open the
                    policy from the policies list to collect the premium.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => paymentMutation.mutate()}
                    disabled={
                      paymentMutation.isPending || amountDue == null || !paymentPhone.trim()
                    }
                  >
                    {paymentMutation.isPending
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <Smartphone className="mr-2 h-4 w-4" />}
                    Send {mobileMoneyLabel} request
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/org/policies")}>
                    Collect later
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </CapabilityGate>
    </div>
  );
}
