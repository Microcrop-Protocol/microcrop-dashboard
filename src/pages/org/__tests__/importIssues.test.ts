import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  parseBackendDetails,
  formatIssue,
  summarizeIssues,
  buildErrorReport,
  buildResultReport,
  catalogueRefusalRows,
} from "../importIssues";

describe("parseBackendDetails", () => {
  it("extracts row index and field from Joi-style field paths", () => {
    const result = parseBackendDetails([
      { field: "farmers.0.county", message: '"farmers[0].county" is required' },
      { field: "farmers.2.phoneNumber", message: '"farmers[2].phoneNumber" must be a string' },
    ]);

    expect(result).toEqual([
      { row: 0, field: "county", message: "is required" },
      { row: 2, field: "phoneNumber", message: "must be a string" },
    ]);
  });

  it("keeps field as-is when there is no row segment", () => {
    const result = parseBackendDetails([{ field: "organizationId", message: '"organizationId" is required' }]);
    expect(result).toEqual([{ field: "organizationId", message: "is required" }]);
  });

  it("returns an empty array for undefined details", () => {
    expect(parseBackendDetails(undefined)).toEqual([]);
  });
});

describe("formatIssue", () => {
  it("shows 1-based row number and field name", () => {
    expect(formatIssue({ row: 0, field: "county", message: "is required" })).toBe("Row 1 · county: is required");
  });

  it("omits row when absent", () => {
    expect(formatIssue({ field: "organizationId", message: "is required" })).toBe("organizationId: is required");
  });

  it("renders a bare message when both row and field are absent", () => {
    expect(formatIssue({ message: "Network unreachable" })).toBe("Network unreachable");
  });
});

describe("summarizeIssues", () => {
  it("groups identical field/message pairs across many rows", () => {
    const issues = [
      { row: 0, field: "county", message: "is required" },
      { row: 1, field: "county", message: "is required" },
      { row: 2, field: "county", message: "is required" },
    ];
    expect(summarizeIssues(issues)).toEqual(["3 rows · county: is required"]);
  });

  it("keeps unique issues separate", () => {
    const issues = [
      { row: 0, field: "county", message: "is required" },
      { row: 1, field: "phoneNumber", message: "must be a string" },
    ];
    expect(summarizeIssues(issues)).toEqual([
      "Row 1 · county: is required",
      "Row 2 · phoneNumber: must be a string",
    ]);
  });
});

describe("buildErrorReport", () => {
  it("renders the actual missing-county error from the backend log", () => {
    const error = new ApiError("Validation failed", 400, "INVALID_INPUT", [
      { field: "farmers.0.county", message: '"farmers[0].county" is required' },
      { field: "farmers.1.county", message: '"farmers[1].county" is required' },
    ]);

    const report = buildErrorReport(error, "farmers");

    expect(report.tone).toBe("error");
    expect(report.title).toBe("Validation failed");
    expect(report.summary).toContain("2 rows");
    expect(report.issues).toEqual(["2 rows · county: is required"]);
  });

  it("caps grouped issue lists to 20 with a trailing more-count line", () => {
    const details = Array.from({ length: 30 }, (_, i) => ({
      field: `farmers.0.customField${i}`,
      message: `"farmers[0].customField${i}" is required`,
    }));
    const error = new ApiError("Validation failed", 400, "INVALID_INPUT", details);

    const report = buildErrorReport(error, "farmers");

    expect(report.issues).toHaveLength(21);
    expect(report.issues[20]).toBe("… and 10 more");
  });

  it("produces a friendly message for network errors", () => {
    const error = new ApiError("Network error. Please check your connection.", 0);
    const report = buildErrorReport(error, "farmers");

    expect(report.tone).toBe("error");
    expect(report.summary).toContain("reach the server");
    expect(report.issues).toEqual([]);
  });

  it("produces a friendly message for 500-class errors", () => {
    const error = new ApiError("Internal server error", 500, "INTERNAL");
    const report = buildErrorReport(error, "farmers");

    expect(report.summary).toContain("500");
  });

  it("degrades gracefully for non-ApiError throwables", () => {
    const report = buildErrorReport(new Error("boom"), "farmers");
    expect(report.tone).toBe("error");
    expect(report.title).toBe("Import failed");
    expect(report.summary).toBe("boom");
  });
});

describe("buildResultReport", () => {
  it("returns null for a fully clean import", () => {
    expect(buildResultReport({ imported: 5, skipped: 0, errors: [], total: 5 }, "farmers")).toBeNull();
  });

  it("maps the server's 1-BASED row to the same row number in the report", () => {
    // The server's row 3 is the file's third data row; the report used to say "Row 4".
    const report = buildResultReport(
      { imported: 2, skipped: 1, errors: [{ row: 3, field: "farmerPhone", message: "Farmer not found" }], total: 3 },
      "plots",
    );
    expect(report?.issues).toEqual(["Row 3 · farmerPhone: Farmer not found"]);
  });

  it("counts failed rows once: skipped (total - imported) is not added on top of errors", () => {
    const report = buildResultReport(
      {
        imported: 2,
        skipped: 2,
        errors: [
          { row: 1, message: "Plot 'East' already exists for this farmer — skipped" },
          { row: 4, message: "Duplicate plot for this farmer within batch" },
        ],
        total: 4,
      },
      "plots",
    );
    expect(report?.tone).toBe("warning");
    expect(report?.summary).toBe("2 imported · 2 failed");
    expect(report?.summary).not.toContain("skipped");
  });

  it("returns a warning report when some rows failed but others succeeded", () => {
    const report = buildResultReport(
      { imported: 2, skipped: 1, errors: [{ row: 3, message: "duplicate phone" }], total: 3 },
      "farmers",
    );

    expect(report?.tone).toBe("warning");
    expect(report?.summary).toContain("2 imported");
    expect(report?.summary).toContain("1 failed");
    expect(report?.issues).toEqual(["Row 3: duplicate phone"]);
  });

  it("returns an error report when nothing imported and everything failed", () => {
    const report = buildResultReport(
      {
        imported: 0,
        skipped: 2,
        errors: [
          { row: 1, message: "already registered" },
          { row: 2, message: "already registered" },
        ],
        total: 2,
      },
      "farmers",
    );

    expect(report?.tone).toBe("error");
    expect(report?.title).toBe("No farmers imported");
    expect(report?.issues).toEqual(["Row 1: already registered", "Row 2: already registered"]);
  });
});

describe("catalogueRefusalRows for herds", () => {
  it("names the livestock rows of a PRODUCT_NOT_IN_MARKET herd refusal", () => {
    expect(
      catalogueRefusalRows({
        countryCode: "KE",
        line: "LIVESTOCK",
        rows: [{ row: 2, livestockType: "POULTRY" }],
      }),
    ).toEqual([{ row: 1, field: "livestockType", message: '"POULTRY" is not in the Kenya livestock list' }]);
  });
});
