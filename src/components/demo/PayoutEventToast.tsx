/**
 * PayoutPulse — demo-only celebratory payout channel.
 *
 * Mounted ONCE on the org dashboard. When demo mode is OFF it renders nothing
 * and subscribes to nothing (production untouched). When ON it watches the
 * simulation engine's payout channel and fires a single amber, clearly-labelled
 * "SIMULATION" toast each time a fresh payout event lands ("Drought trigger
 * fired — payout sent"). Amounts are formatted through `@/lib/market` so KE
 * (KES) and GH (GHS) payouts show the right currency.
 *
 * This is purely cosmetic client-side theatre — no backend, money, or
 * money-logic is touched.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { CircleDollarSign, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/market";
import {
  useDemoMode,
  usePayoutEvents,
  type MarketCode,
  type PayoutEvent,
} from "@/lib/demo";

const MARKET_FLAG: Record<MarketCode, string> = {
  KE: "🇰🇪",
  GH: "🇬🇭",
};

export function PayoutPulse() {
  const { enabled } = useDemoMode();
  if (!enabled) return null;
  return <PayoutPulseInner />;
}

function PayoutPulseInner() {
  const { latest } = usePayoutEvents();
  const seenId = useRef<string | null>(null);

  useEffect(() => {
    if (!latest || latest.id === seenId.current) return;
    seenId.current = latest.id;
    firePayoutToast(latest);
  }, [latest]);

  return null;
}

function perilTitle(event: PayoutEvent): string {
  const peril = `${event.peril[0].toUpperCase()}${event.peril.slice(1)}`;
  return `${peril} trigger fired — payout sent`;
}

function firePayoutToast(event: PayoutEvent) {
  toast.custom(
    () => (
      <div
        className={cn(
          "flex w-full items-start gap-3 rounded-lg border border-warning/40 bg-background p-4 shadow-lg",
          "ring-1 ring-warning/20",
        )}
      >
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold leading-tight">{perilTitle(event)}</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
              <Zap className="h-2.5 w-2.5" aria-hidden="true" />
              Simulation
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {MARKET_FLAG[event.market]} {event.region} · <span className="capitalize">{event.crop}</span>
            {" · "}
            {event.farmersPaid} farmer{event.farmersPaid === 1 ? "" : "s"} paid
          </p>
          <p className="text-sm font-bold tabular-nums text-warning">
            {formatCurrency(event.amount, event.currency)}
          </p>
        </div>
      </div>
    ),
    { duration: 5000 },
  );
}
