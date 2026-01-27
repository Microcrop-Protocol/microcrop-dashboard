import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Granularity } from "@/types";

interface GranularitySelectProps {
  value: Granularity;
  onChange: (value: Granularity) => void;
  className?: string;
}

export function GranularitySelect({ value, onChange, className }: GranularitySelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-[120px]", className)}>
        <SelectValue placeholder="Granularity" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="daily">Daily</SelectItem>
        <SelectItem value="weekly">Weekly</SelectItem>
        <SelectItem value="monthly">Monthly</SelectItem>
      </SelectContent>
    </Select>
  );
}
