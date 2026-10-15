import { ApiError, type ApiErrorDetail } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/error-messages";
import { PRODUCT_NOT_IN_MARKET } from "@/lib/catalogue";
import { marketOrNull } from "@/lib/market";

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

/**
 * The bulk-import response, the same for farmers, plots and herds:
 * `{imported, skipped, errors: [{row, field, message}], total}`. `row` is 1-BASED. `skipped` is
 * `total - imported`, so it already counts every errored row — it is not a separate tally.
 */
export interface BulkImportResultLike {
  imported?: number;
  skipped?: number;
  errors?: { row: number; field?: string; message: string }[];
  total?: number;
}

const MAX_INLINE_ISSUES = 20;

/** At most 20 lines inline, then "… and N more". */
export function capIssues(list: string[]): string[] {
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
  // Defensive: the client routes an object-shaped `details` to ApiError.context, but a
  // hand-built ApiError could still carry one here, and `.map` on it would throw.
  if (!Array.isArray(details)) return [];
  return details.map((d) => {
    const message = cleanJoiMessage(d.message);
    const match = d.field?.match(/^[^.]+\.(\d+)\.(.+)$/);
    if (match) {
      return { row: parseInt(match[1], 10), field: match[2], message };
    }
    return { field: d.field, message };
  });
}

/**
 * Per-row issues from a PRODUCT_NOT_IN_MARKET bulk refusal: `details.rows` is
 * `[{ row, cropType }]` for plots or `[{ row, livestockType }]` for herds, with 1-based rows
 * (farmer.service.bulkImportPlots, herd.service.bulkImport). Rows without a usable number are
 * skipped; with no `rows` at all, each code in `details.items` becomes one row-less line.
 */
export function catalogueRefusalRows(context: unknown): ImportIssue[] {
  if (!context || typeof context !== "object" || Array.isArray(context)) return [];
  const d = context as Record<string, unknown>;
  const livestock = d.line === "LIVESTOCK";
  const field = livestock ? "livestockType" : "cropType";
  // Same wording as the pre-upload checks in importTemplates, so both reports read alike.
  const countryName = marketOrNull(d.countryCode)?.countryName;
  const noun = livestock ? "livestock" : "crop";
  const list = countryName ? `the ${countryName} ${noun} list` : `your market's ${noun} list`;
  const blank = livestock ? "A blank livestock type" : "A blank crop";
  const describe = (code: unknown) =>
    typeof code === "string" && code.trim()
      ? `"${code.trim()}" is not in ${list}`
      : `${blank} is not in ${list}`;

  if (Array.isArray(d.rows)) {
    return d.rows.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const e = entry as { row?: unknown; cropType?: unknown; livestockType?: unknown };
      const n = typeof e.row === "number" ? e.row : Number(e.row);
      const code = livestock ? e.livestockType : (e.cropType ?? e.livestockType);
      // formatIssue prints `row + 1`, so the server's 1-based row is stored 0-based.
      return Number.isInteger(n) && n >= 1 ? [{ row: n - 1, field, message: describe(code) }] : [];
    });
  }
  if (Array.isArray(d.items)) {
    return d.items.map((code) => ({ field, message: describe(code) }));
  }
  return [];
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
    // A catalogue refusal of the whole file (a crop the market does not list) is a product
    // boundary with its own wording; the raw backend message is not shown in its place. The
    // refusal's OBJECT details carry `rows: [{ row, cropType }]` (1-based) naming every
    // offending row — kept here, so the report says which rows to fix, not just that some exist.
    if (error.code === PRODUCT_NOT_IN_MARKET) {
      const refusedRows = catalogueRefusalRows(error.context);
      return {
        tone: "error",
        title: "Not in your market's product list",
        summary: getErrorMessage(error),
        issues: capIssues(refusedRows.length > 0 ? summarizeIssues(refusedRows) : grouped),
      };
    }
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
      issues: capIssues(grouped),
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
 * Translate a successful bulk-import response into an inline report. Returns null when every row
 * landed (no per-row errors) — the toast alone is enough in that case.
 *
 * Server rows are 1-BASED; formatIssue prints `row + 1`, so they are stored 0-based here (the
 * report used to say "Row 4" for the server's row 3). The count is "N imported · M failed" from
 * `errors` alone: `skipped` is `total - imported`, which already includes every failed row, and a
 * re-imported duplicate is now a per-row error, so adding `skipped` counted those rows twice.
 */
export function buildResultReport(
  result: BulkImportResultLike | null | undefined,
  label: string,
): ImportReport | null {
  const imported = result?.imported ?? 0;
  const rowErrors = result?.errors ?? [];

  if (rowErrors.length === 0) return null;

  // One line per row, not grouped: a partner fixing a partial import needs every row number.
  const issues = rowErrors.map((e) =>
    formatIssue({
      row: Number.isInteger(e.row) && e.row >= 1 ? e.row - 1 : undefined,
      field: e.field,
      message: e.message,
    }),
  );

  if (imported === 0) {
    return {
      tone: "error",
      title: `No ${label} imported`,
      summary: `${rowErrors.length} ${rowErrors.length === 1 ? "row" : "rows"} failed — see details below.`,
      issues: capIssues(issues),
    };
  }

  return {
    tone: "warning",
    title: `${label[0].toUpperCase()}${label.slice(1)} imported with issues`,
    summary: `${imported} imported · ${rowErrors.length} failed`,
    issues: capIssues(issues),
  };
}
