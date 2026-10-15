import { useState, useRef, type DragEvent, type ChangeEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, FileSpreadsheet, X, Download, AlertCircle, AlertTriangle } from "lucide-react";
import { notifySuccess, notifyError } from "@/lib/notify";
import {
  parseCsv,
  normalizeFarmerHeader,
  normalizePlotHeader,
  normalizeHerdHeader,
  describeRequiredColumn,
  FARMER_REQUIRED,
  FARMER_OPTIONAL,
  PLOT_REQUIRED,
  PLOT_OPTIONAL,
  HERD_REQUIRED,
  HERD_OPTIONAL,
  type RequiredColumn,
} from "./csvImport";
import {
  buildErrorReport,
  buildResultReport,
  type ImportReport,
} from "./importIssues";
import { CapabilityGate } from "@/components/capability/CapabilityGate";
import { useCapability } from "@/hooks/useCapabilities";
import { CAPABILITY } from "@/lib/capability";
import { useOrgMarket } from "@/hooks/useOrgMarket";
import { useCatalogue } from "@/hooks/useCatalogue";
import { CatalogueStatusBadge } from "@/components/catalogue/CatalogueOptions";
import {
  csvToJsonExample,
  farmerCsvTemplate,
  herdCsvTemplate,
  importableCrops,
  plotCsvTemplate,
  prepareFarmerRows,
  prepareHerdRows,
  preparePlotRows,
  type PreparedRows,
} from "./importTemplates";
import type { BulkImportResult } from "@/lib/api/client";
import { level1Label } from "@/lib/market";

/** The server's per-request cap, enforced here for CSV and JSON alike. */
const MAX_ROWS = 500;

function downloadTemplate(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface FileDropZoneProps {
  file: File | null;
  onFile: (file: File | null) => void;
  accept: string;
  label: string;
}

function FileDropZone({ file, onFile, accept, label }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.csv') || dropped.type === 'text/csv')) {
      onFile(dropped);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) onFile(selected);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <FileSpreadsheet className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium truncate">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onFile(null);
            if (inputRef.current) inputRef.current.value = '';
          }}
          aria-label="Remove file"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
      }`}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
    >
      <Upload className="h-8 w-8 text-muted-foreground mb-3" aria-hidden="true" />
      <p className="font-medium">{label}</p>
      <p className="text-sm text-muted-foreground mt-1">
        Drag and drop or click to browse
      </p>
      <p className="text-xs text-muted-foreground mt-1">CSV files only</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

interface ImportReportPanelProps {
  report: ImportReport;
  onDismiss: () => void;
}

function ImportReportPanel({ report, onDismiss }: ImportReportPanelProps) {
  const Icon = report.tone === "error" ? AlertCircle : AlertTriangle;
  const variant = report.tone === "error" ? "destructive" : "default";
  const warningClasses =
    report.tone === "warning"
      ? "border-amber-500/50 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-500"
      : "";

  return (
    <Alert variant={variant} className={warningClasses}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <AlertTitle>{report.title}</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{report.summary}</p>
            {report.issues.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs max-h-56 overflow-auto">
                {report.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-1 h-6 w-6 shrink-0"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </Alert>
  );
}

interface ImportSectionProps {
  /** Plural noun used in copy: "farmers", "plots", "herds". */
  noun: string;
  /** Singular title noun: "Farmers". */
  title: string;
  normalizeHeader: (h: string) => string;
  required: readonly RequiredColumn[];
  optional: readonly string[];
  /** Column display names where the template header differs from the canonical field. */
  columnLabels?: Record<string, string>;
  template: string;
  templateFilename: string;
  prepare: (rows: Record<string, unknown>[]) => PreparedRows;
  send: (rows: Record<string, unknown>[]) => Promise<BulkImportResult>;
  /** Runs after a response with at least one imported row. */
  onImported: (result: BulkImportResult) => void;
  /** Extra help under the column list. */
  help?: ReactNode;
}

/**
 * One import type: CSV or JSON in, the same checks on both, the report out. CSV and JSON both go
 * through the type's preparer and the 500-row cap, so a pasted array is never sent unchecked.
 */
function ImportSection({
  noun,
  title,
  normalizeHeader,
  required,
  optional,
  columnLabels = {},
  template,
  templateFilename,
  prepare,
  send,
  onImported,
  help,
}: ImportSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [json, setJson] = useState("");
  const [mode, setMode] = useState<"csv" | "json">("csv");
  const [report, setReport] = useState<ImportReport | null>(null);

  const mutation = useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => send(rows),
    onSuccess: (result) => {
      const imported = result?.imported ?? 0;
      const resultReport = buildResultReport(result, noun);
      setReport(resultReport);
      if (resultReport?.tone === "error") {
        notifyError(undefined, resultReport.summary);
      } else if (resultReport) {
        notifySuccess(resultReport.title, resultReport.summary);
      } else {
        notifySuccess(`${title} imported`, `Successfully imported ${imported} ${noun}.`);
      }
      if (imported > 0) {
        setJson("");
        setFile(null);
        onImported(result);
      }
    },
    onError: (error) => {
      setReport(buildErrorReport(error, noun));
      notifyError(error, `Couldn't import your ${noun}. Please check the file and try again.`);
    },
  });

  const showClientError = (errorTitle: string, message: string) => {
    setReport({ tone: "error", title: errorTitle, summary: message, issues: [] });
    notifyError(undefined, message);
  };

  const submit = (rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return showClientError("Empty file", "The file has no data rows.");
    if (rows.length > MAX_ROWS) {
      return showClientError("Too many rows", `Maximum ${MAX_ROWS} ${noun} per import.`);
    }
    const { rows: prepared, blocking } = prepare(rows);
    if (blocking) {
      setReport(blocking);
      notifyError(undefined, blocking.summary);
      return;
    }
    mutation.mutate(prepared);
  };

  const handleCsv = async () => {
    if (!file) return;
    setReport(null);
    let parsed: ReturnType<typeof parseCsv>;
    try {
      parsed = parseCsv(await file.text(), { normalizeHeader, required });
    } catch {
      return showClientError("Parse error", "Failed to read CSV file.");
    }
    if (parsed.error) return showClientError("Invalid CSV", parsed.error);
    submit(parsed.rows);
  };

  const handleJson = () => {
    setReport(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return showClientError("Invalid JSON", "Please enter valid JSON.");
    }
    if (!Array.isArray(parsed)) return showClientError("Invalid format", "Input must be a JSON array.");
    if (parsed.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
      return showClientError("Invalid format", `Each item must be an object describing one of your ${noun}.`);
    }
    submit(parsed as Record<string, unknown>[]);
  };

  const importButton = (onClick: () => void, disabled: boolean) => (
    <Button onClick={onClick} disabled={disabled || mutation.isPending}>
      {mutation.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
      )}
      Import {title}
    </Button>
  );

  const label = (c: string) => columnLabels[c] ?? c;

  return (
    <>
      {report && <ImportReportPanel report={report} onDismiss={() => setReport(null)} />}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Import {title} (Max {MAX_ROWS})</CardTitle>
              <CardDescription>Upload a CSV file or paste JSON data</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant={mode === "csv" ? "default" : "outline"} size="sm" onClick={() => setMode("csv")}>
                CSV File
              </Button>
              <Button variant={mode === "json" ? "default" : "outline"} size="sm" onClick={() => setMode("json")}>
                JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "csv" ? (
            <>
              <FileDropZone file={file} onFile={setFile} accept=".csv,text/csv" label={`Upload ${noun} CSV file`} />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {importButton(handleCsv, !file)}
                <Button variant="ghost" size="sm" onClick={() => downloadTemplate(template, templateFilename)}>
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Download Template
                </Button>
              </div>
            </>
          ) : (
            <>
              <Textarea
                placeholder={csvToJsonExample(template)}
                rows={10}
                value={json}
                onChange={(e) => setJson(e.target.value)}
              />
              {importButton(handleJson, !json.trim())}
            </>
          )}
          {/* Generated from the *_REQUIRED / *_OPTIONAL constants the parser checks, so the help
              cannot list a column the parser does not require, or miss one it does. */}
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Required columns:</p>
            <p className="font-mono" data-testid={`${noun}-required-columns`}>
              {required.map((c) => describeRequiredColumn(c, columnLabels)).join(", ")}
            </p>
            {optional.length > 0 && (
              <>
                <p className="font-medium pt-1">Optional columns:</p>
                <p className="font-mono">{optional.map(label).join(", ")}</p>
              </>
            )}
            {help}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function FarmerImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bulkImport = useCapability(CAPABILITY.BULK_IMPORT);
  const livestockUnderwriting = useCapability(CAPABILITY.LIVESTOCK_UNDERWRITING);
  // `market` is null until the organization resolves, and the template helpers render an empty
  // sample number rather than a Kenyan one in that window. The catalogue supplies the sample crop
  // and the list of crop codes a plots file may carry.
  const { market } = useOrgMarket();
  const { market: catalogue, state: catalogueState } = useCatalogue();
  const crops = importableCrops(catalogue);

  // Herd import is the file alternative to livestock onboarding, so it shows exactly where that
  // onboarding is offered: a market that lists livestock AND an organization granted livestock
  // underwriting. Ghana lists none, and the tab is not there at all.
  const livestockMarket = market?.livestockEnabled === true;
  const showHerds = livestockMarket && livestockUnderwriting.allowed;
  const herdsNote = !market
    ? null
    : !livestockMarket
      ? `Herd import isn't available: livestock cover is not offered in ${market.countryName}.`
      : livestockUnderwriting.state === "unavailable"
        ? "Herd import needs livestock underwriting, which isn't enabled for your organization."
        : null;
  const regionLabel = level1Label(market);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground">
          Import farmers, plots{showHerds ? " and herds" : ""} you already hold, via CSV or JSON — the
          alternative to onboarding them one at a time
        </p>
      </div>

      {/*
        BULK_IMPORT is off for new organizations by default — it is high-volume PII intake
        (national IDs) by an organization that may not have passed KYB. The route already
        requires the `bulkImport` PERMISSION; this is the orthogonal organization-level question,
        and it replaces the whole surface because every control on the page is an import control.
      */}
      <CapabilityGate
        capability={CAPABILITY.BULK_IMPORT}
        state={bulkImport.state}
        onRetry={bulkImport.refetch}
      >
      <Tabs defaultValue="farmers">
        <TabsList>
          <TabsTrigger value="farmers">Import Farmers</TabsTrigger>
          <TabsTrigger value="plots">Import Plots</TabsTrigger>
          {showHerds && <TabsTrigger value="herds">Import Herds</TabsTrigger>}
        </TabsList>

        <TabsContent value="farmers" className="space-y-4">
          <ImportSection
            noun="farmers"
            title="Farmers"
            normalizeHeader={normalizeFarmerHeader}
            required={FARMER_REQUIRED}
            optional={FARMER_OPTIONAL}
            template={farmerCsvTemplate(market)}
            templateFilename="farmers-template.csv"
            prepare={(rows) => prepareFarmerRows(rows, market)}
            send={(rows) => api.bulkImportFarmers(rows)}
            onImported={(result) => {
              queryClient.invalidateQueries({ queryKey: ["farmers"] });
              // Leave the page only when every row landed: on a partial import the report of the
              // failed rows is what the partner needs to see next.
              if ((result?.errors ?? []).length === 0) navigate("/org/farmers");
            }}
            help={
              <>
                <p className="pt-1">
                  <span className="font-mono">county</span> is your {regionLabel.toLowerCase()} column
                  {regionLabel !== "County" ? <> (a <span className="font-mono">{regionLabel.toLowerCase()}</span> header is accepted)</> : null}.
                  Phone numbers may be local or international.
                </p>
                <p>
                  Farmers arrive with KYC <span className="font-mono">PENDING</span> unless the row says{" "}
                  <span className="font-mono">kycStatus=APPROVED</span>, which needs an organization admin.
                </p>
                <p>
                  Consent: fill all of consentDocumentIds (separate several with ;), consentMethod,
                  consentGrantedAt and consentEvidenceRef for a farmer who consented, or leave them all
                  empty. A yes/no consented column is refused.
                </p>
              </>
            }
          />
        </TabsContent>

        <TabsContent value="plots" className="space-y-4">
          <ImportSection
            noun="plots"
            title="Plots"
            normalizeHeader={normalizePlotHeader}
            required={PLOT_REQUIRED}
            optional={PLOT_OPTIONAL}
            columnLabels={{ name: "plotName" }}
            template={plotCsvTemplate(market, catalogue)}
            templateFilename="plots-template.csv"
            prepare={(rows) => preparePlotRows(rows, catalogue, catalogueState)}
            send={(rows) => api.bulkImportPlots(rows)}
            onImported={() => {
              queryClient.invalidateQueries({ queryKey: ["plots"] });
            }}
            help={
              <>
                <p className="pt-1">
                  Name the farmer by farmerPhone or farmerNationalId. Acreage is in acres (a hectares
                  column is converted).
                </p>
                <p>
                  <span className="font-mono">plantingDate</span> (YYYY-MM-DD) is needed for drought
                  determination — without it the plot cannot be assessed.
                </p>
                {/*
                  The cropType values this organization's market accepts, from the catalogue. A
                  crop outside this list is refused by the server, so the file is checked against
                  it before upload and the offending rows named.
                */}
                <p className="pt-1 font-medium">
                  cropType values{catalogue ? ` for ${catalogue.countryName}` : ""}:
                </p>
                {catalogue ? (
                  <>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                      {crops.sellable.map((c) => (
                        <span key={c.code} className="inline-flex items-center gap-1">
                          {c.code}
                          <CatalogueStatusBadge status={c.status} />
                        </span>
                      ))}
                    </p>
                    {crops.notInsurableYet.length > 0 && (
                      <p className="mt-2">
                        Can be registered, but cannot be insured yet:{" "}
                        <span className="font-mono">{crops.notInsurableYet.map((c) => c.code).join(", ")}</span>
                      </p>
                    )}
                  </>
                ) : catalogueState === "loading" ? (
                  <p>Your market&apos;s crop list is still loading.</p>
                ) : (
                  <p>We couldn&apos;t load your market&apos;s crop list. Reload the page to try again.</p>
                )}
              </>
            }
          />
        </TabsContent>

        {showHerds && (
          <TabsContent value="herds" className="space-y-4">
            <ImportSection
              noun="herds"
              title="Herds"
              normalizeHeader={normalizeHerdHeader}
              required={HERD_REQUIRED}
              optional={HERD_OPTIONAL}
              template={herdCsvTemplate(market, catalogue)}
              templateFilename="herds-template.csv"
              prepare={(rows) => prepareHerdRows(rows, catalogue, market, catalogueState)}
              send={(rows) => api.bulkImportHerds(rows)}
              onImported={() => {
                queryClient.invalidateQueries({ queryKey: ["herds"] });
              }}
              help={
                <>
                  <p className="pt-1">
                    Name the farmer by farmerPhone or farmerNationalId. The farmer&apos;s{" "}
                    {regionLabel.toLowerCase()} must match one of your coverage regions (insurance
                    units) — a herd elsewhere can&apos;t be priced and its row is refused.
                  </p>
                  <p>
                    headCount is a whole number of animals; estimatedValue is per head, in{" "}
                    {market?.currency ?? "your currency"}. The insurance unit and TLU are worked out
                    for you.
                  </p>
                  <p className="pt-1 font-medium">
                    livestockType values{catalogue ? ` for ${catalogue.countryName}` : ""}:
                  </p>
                  <p className="font-mono">
                    {catalogue
                      ? catalogue.lines.LIVESTOCK.map((l) => l.code).join(", ")
                      : "loading…"}
                  </p>
                </>
              }
            />
          </TabsContent>
        )}
      </Tabs>
      {herdsNote && <p className="mt-4 text-sm text-muted-foreground">{herdsNote}</p>}
      </CapabilityGate>
    </div>
  );
}
