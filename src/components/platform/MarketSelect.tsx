import { Globe2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  marketFilterOptions,
  type MarketFilter,
  type MarketFilterMode,
} from "@/lib/market-filter";

interface MarketSelectProps {
  value: MarketFilter;
  onChange: (value: MarketFilter) => void;
  /** 'single' omits "All markets" — for screens whose money is one currency. */
  mode: MarketFilterMode;
  className?: string;
}

/**
 * The market picker for platform-admin screens. Always rendered with the market in use, so a
 * default (the first registry market on money screens) is visible rather than implied.
 */
export function MarketSelect({ value, onChange, mode, className }: MarketSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MarketFilter)}>
      <SelectTrigger className={cn("w-[180px]", className)} aria-label="Select market">
        <Globe2 className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <SelectValue placeholder="Market" />
      </SelectTrigger>
      <SelectContent>
        {marketFilterOptions(mode).map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
