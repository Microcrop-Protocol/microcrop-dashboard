import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolves a file URL by prepending the API base URL to relative paths.
 * Absolute URLs (http/https) are returned as-is.
 */
export function resolveFileUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const rawBase = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  // Tolerate a scheme-less VITE_API_URL (see api/client.ts) so file URLs resolve absolutely.
  const apiBase = rawBase && !/^https?:\/\//i.test(rawBase) ? `https://${rawBase}` : rawBase;
  return `${apiBase}${url}`;
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
