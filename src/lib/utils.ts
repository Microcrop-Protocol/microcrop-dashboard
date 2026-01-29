import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  dateValue: string | Date | undefined | null,
  formatStr: string = "MMM d, yyyy",
  fallback: string = "-"
): string {
  if (!dateValue) return fallback;

  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  if (!isValid(date)) return fallback;

  try {
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}
