import { ApiError, type ApiErrorDetail } from "@/lib/api/client";

export interface ImportIssue {
  row?: number;
  field?: string;
  message: string;
}

export interface ImportReport {
  tone: "error" | "warning";
  title: string;
  summary: string;
  issues: string[];
}

export interface BulkImportResultLike {
  imported?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
  total?: number;
}

const MAX_INLINE_ISSUES = 20;

function cap(list: string[]): string[] {
  if (list.length <= MAX_INLINE_ISSUES) return list;
  const head = list.slice(0, MAX_INLINE_ISSUES);
  head.push(`… and ${list.length - MAX_INLINE_ISSUES} more`);
  return head;
}

/**
 * Backend validation errors (from Joi) arrive with fields like
 * "farmers.0.county" and messages like `"farmers[0].county" is required`.
 * Split the row index and field name out, and trim the Joi label prefix
 * so the rendered message reads naturally.
 */
export function parseBackendDetails(details: ApiErrorDetail[] | undefined): ImportIssue[] {
  if (!details) return [];
  return details.map((d) => {
    const message = cleanJoiMessage(d.message);
    const match = d.field?.match(/^[^.]+\.(\d+)\.(.+)$/);
    if (match) {
      return { row: parseInt(match[1], 10), field: match[2], message };
    }
    return { field: d.field, message };
  });
}

function cleanJoiMessage(msg: string): string {
  return msg.replace(/^"[^"]+"\s*/, "");
}

export function formatIssue(issue: ImportIssue): string {
  const parts: string[] = [];
  if (issue.row !== undefined) parts.push(`Row ${issue.row + 1}`);
  if (issue.field) parts.push(issue.field);
  const prefix = parts.join(" · ");
  return prefix ? `${prefix}: ${issue.message}` : issue.message;
}

/**
 * Group by field so that "every row is missing county" collapses to one line
 * instead of spamming the panel with 50 identical messages.
 */
export function summarizeIssues(issues: ImportIssue[]): string[] {
  const byKey = new Map<string, { issue: ImportIssue; rows: number[] }>();

  for (const issue of issues) {
    const key = `${issue.field ?? ""}|${issue.message}`;
    const entry = byKey.get(key);
    if (entry) {
      if (issue.row !== undefined) entry.rows.push(issue.row);
    } else {
      byKey.set(key, {
        issue,
        rows: issue.row !== undefined ? [issue.row] : [],
      });
    }
  }

  return Array.from(byKey.values()).map(({ issue, rows }) => {
    if (rows.length > 1) {
      const label = issue.field ?? "issue";
      return `${rows.length} rows · ${label}: ${issue.message}`;
    }
    return formatIssue(issue);
  });
}

/**
 * Translate a thrown error into the inline report shown below the upload card.
 * ApiError.details comes from the backend's structured validator response;
 * anything else (network errors, 500s without details) degrades to a single
 * summary line.
 */
export function buildErrorReport(error: unknown, label: string): ImportReport {
  if (error instanceof ApiError) {
    const raw = parseBackendDetails(error.details);
    const grouped = summarizeIssues(raw);
    const failingRowCount = new Set(
      raw.map((i) => i.row).filter((r): r is number => r !== undefined),
    ).size;
    const summary =
      error.status === 0
        ? "Couldn't reach the server — check your connection and try again."
        : error.status >= 500
          ? `Server error (HTTP ${error.status}). Please try again in a moment.`
          : failingRowCount > 0
            ? `The server rejected ${failingRowCount} ${failingRowCount === 1 ? "row" : "rows"} of your ${label}.`
            : error.message;
    return {
      tone: "error",
      title: error.message || `Import failed`,
      summary,
      issues: cap(grouped),
    };
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return {
    tone: "error",
    title: "Import failed",
    summary: message,
    issues: [],
  };
}

/**
 * Translate a successful bulk-import response into an inline report. Returns
 * null when everything landed cleanly (no skipped, no per-row errors) — the
 * toast alone is enough in that case.
 */
export function buildResultReport(
  result: BulkImportResultLike | null | undefined,
  label: string,
): ImportReport | null {
  const imported = result?.imported ?? 0;
  const skipped = result?.skipped ?? 0;
  const rowErrors = result?.errors ?? [];

  if (imported === 0 && rowErrors.length === 0 && skipped === 0) return null;
  if (rowErrors.length === 0 && skipped === 0) return null;

  const issues = rowErrors.map((e) => formatIssue({ row: e.row, message: e.message }));

  if (imported === 0 && rowErrors.length > 0) {
    return {
      tone: "error",
      title: `No ${label} imported`,
      summary: `${rowErrors.length} ${rowErrors.length === 1 ? "row" : "rows"} failed — see details below.`,
      issues: cap(issues),
    };
  }

  const parts: string[] = [`${imported} imported`];
  if (skipped > 0) parts.push(`${skipped} skipped as duplicates`);
  if (rowErrors.length > 0) parts.push(`${rowErrors.length} failed`);

  return {
    tone: "warning",
    title: `${label[0].toUpperCase()}${label.slice(1)} imported with issues`,
    summary: parts.join(" · "),
    issues: cap(issues),
  };
}
