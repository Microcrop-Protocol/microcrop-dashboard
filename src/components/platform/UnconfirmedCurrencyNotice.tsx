import { AlertTriangle } from "lucide-react";

/**
 * Shown when a money response did not confirm the market it is denominated in — an older backend
 * that ignored `?countryCode=`, or a market/currency pair the dashboard does not recognise. The
 * figures still render, with no currency token, because an unlabelled number is incomplete
 * whereas a guessed currency is a false statement about money.
 */
export function UnconfirmedCurrencyNotice({ requested }: { requested: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <p>
        The server did not confirm that these figures are for {requested} only, so amounts are shown
        without a currency. They may combine more than one market.
      </p>
    </div>
  );
}
