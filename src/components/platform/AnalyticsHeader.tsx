import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { GranularitySelect } from "@/components/ui/granularity-select";
import { MarketSelect } from "@/components/platform/MarketSelect";
import type { MarketFilterState } from "@/hooks/useMarketFilter";
import type { MarketFilterMode } from "@/lib/market-filter";
import type { Granularity } from "@/types";

interface AnalyticsHeaderProps {
  title: string;
  description: string;
  mode: MarketFilterMode;
  marketFilter: MarketFilterState;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  /** Omit for screens with no time series (damage assessments). */
  granularity?: Granularity;
  onGranularityChange?: (granularity: Granularity) => void;
}

/** Title + market / granularity / date controls shared by the platform analytics pages. */
export function AnalyticsHeader({
  title,
  description,
  mode,
  marketFilter,
  dateRange,
  onDateRangeChange,
  granularity,
  onGranularityChange,
}: AnalyticsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MarketSelect mode={mode} value={marketFilter.value} onChange={marketFilter.setValue} />
        {granularity && onGranularityChange && (
          <GranularitySelect value={granularity} onChange={onGranularityChange} />
        )}
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
      </div>
    </div>
  );
}

