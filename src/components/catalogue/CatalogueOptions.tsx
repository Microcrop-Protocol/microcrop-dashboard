/**
 * CATALOGUE PICKER PARTS — the market's own crops or livestock, badged and explained.
 *
 * Every picker that chooses a crop or a livestock type for a NEW plot, herd or policy is built
 * from these, so the three statuses read the same everywhere:
 *
 *   AVAILABLE    a plain choice.
 *   PILOT        a choice, badged "Pilot" — the policy records that it was sold under the pilot,
 *                and a partner selling it should know that before the farmer does.
 *   COMING_SOON  listed, with the reason inline. For SELLING (`purpose="sell"`, the default) it is
 *                DISABLED: hiding it would make a partner ask why the crop it was told about is
 *                missing; offering it would end in a refused quote. For REGISTERING a plot
 *                (`purpose="register"`) it is a CHOICE, labelled "Coming soon — cannot be insured
 *                yet": the backend accepts a listed crop of any status on a new plot.
 *
 * A PILOT/AVAILABLE item the SERVER marks `sellable: false` is treated like COMING_SOON, with the
 * server's `reason` ("Pricing not configured yet") as its note.
 *
 * The option's ItemText holds only the label, so the closed trigger reads "Sorghum" rather than
 * "Sorghum Pilot Sorghum is a pilot product…". Built on the Radix primitive for that reason — the
 * shared SelectItem wraps all of its children in ItemText.
 */
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, CircleSlash, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CATALOGUE_STATUS,
  CATALOGUE_UNKNOWN_MESSAGE,
  catalogueStatusLabel,
  isSellable,
  notSellableNote,
  pilotNote,
} from '@/lib/catalogue';
import type { CatalogueItem, CatalogueStatus } from '@/types/catalogue';

export function CatalogueStatusBadge({
  status,
  className,
}: {
  status: CatalogueStatus | string | null | undefined;
  className?: string;
}) {
  const label = catalogueStatusLabel(status);
  if (!label) return null;
  return (
    <Badge
      variant={status === CATALOGUE_STATUS.PILOT ? 'secondary' : 'outline'}
      className={cn('px-2 py-0 text-[10px] font-medium uppercase tracking-wide', className)}
    >
      {label}
    </Badge>
  );
}

/**
 * The options for a Select's content. `items` is one catalogue line, in the server's order.
 * An empty line renders one disabled row saying so, rather than an empty dropdown.
 */
export function CatalogueSelectItems({
  items,
  countryName,
  emptyMessage,
  purpose = 'sell',
}: {
  items: readonly CatalogueItem[];
  countryName: string;
  emptyMessage: string;
  /**
   * 'sell' (default): only sellable items can be chosen. 'register': every listed item can be
   * chosen — the picker for a NEW plot, which the backend accepts in any catalogue status.
   */
  purpose?: 'sell' | 'register';
}) {
  if (items.length === 0) {
    return (
      <SelectPrimitive.Item
        value="__none__"
        disabled
        className="relative flex w-full select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-muted-foreground outline-none"
      >
        <SelectPrimitive.ItemText>{emptyMessage}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  }

  return (
    <>
      {items.map((item) => {
        const sellable = isSellable(item);
        const note = notSellableNote(item, countryName, purpose);
        // In a register picker the note already says "Coming soon", so the badge would repeat it.
        const showBadge = !(purpose === 'register' && item.status === CATALOGUE_STATUS.COMING_SOON);
        return (
          <SelectPrimitive.Item
            key={item.code}
            value={item.code}
            disabled={purpose === 'sell' && !sellable}
            className={cn(
              'relative flex w-full cursor-default select-none flex-col items-start rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
              'focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none',
            )}
          >
            <span className="absolute left-2 top-2 flex h-3.5 w-3.5 items-center justify-center">
              <SelectPrimitive.ItemIndicator>
                <Check className="h-4 w-4" />
              </SelectPrimitive.ItemIndicator>
            </span>
            <span className="flex items-center gap-2">
              <span className={cn(!sellable && 'text-muted-foreground')}>
                <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
              </span>
              {showBadge && <CatalogueStatusBadge status={item.status} />}
            </span>
            {note && <span className="mt-0.5 text-xs text-muted-foreground">{note}</span>}
          </SelectPrimitive.Item>
        );
      })}
    </>
  );
}

/**
 * What the selected item insures against and on which index — the line a field agent reads aloud
 * to a farmer — plus the pilot note when it applies.
 */
export function CatalogueItemDetails({
  item,
  countryName,
  className,
}: {
  item: CatalogueItem | null;
  countryName: string;
  className?: string;
}) {
  if (!item) return null;
  return (
    <div className={cn('space-y-1 text-xs text-muted-foreground', className)}>
      <p>
        <span className="font-medium text-foreground">{item.peril}</span>
        {' · '}
        {item.index}
      </p>
      <p>
        Cover period: {item.coverPeriod} · Insurable unit: {item.insurableUnit}
      </p>
      {item.precedent && <p>Precedent: {item.precedent}</p>}
      {item.status === CATALOGUE_STATUS.PILOT && (
        <p className="text-amber-700 dark:text-amber-400">{pilotNote(item.label, countryName)}</p>
      )}
    </div>
  );
}

/** Shown in place of a picker when the catalogue could not be loaded. Never a fallback list. */
export function CatalogueUnknownNote({
  onRetry,
  className,
}: {
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <span className="flex items-start gap-2">
        <CircleSlash className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {CATALOGUE_UNKNOWN_MESSAGE}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
