import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
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
  FARMER_REQUIRED,
  PLOT_REQUIRED,
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
  importableCrops,
  plotCsvTemplate,
  preparePlotRows,
} from "./importTemplates";

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

export default function FarmerImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [farmersFile, setFarmersFile] = useState<File | null>(null);
  const [plotsFile, setPlotsFile] = useState<File | null>(null);
  const [farmersJson, setFarmersJson] = useState("");
  const [plotsJson, setPlotsJson] = useState("");
  const [farmersImportMode, setFarmersImportMode] = useState<'csv' | 'json'>('csv');
  const [plotsImportMode, setPlotsImportMode] = useState<'csv' | 'json'>('csv');
  const [farmersReport, setFarmersReport] = useState<ImportReport | null>(null);
  const [plotsReport, setPlotsReport] = useState<ImportReport | null>(null);
  const bulkImport = useCapability(CAPABILITY.BULK_IMPORT);
  // `market` is null until the organization resolves, and the template helpers render an empty
  // sample number rather than a Kenyan one in that window. The catalogue supplies the sample crop
  // and the list of crop codes a plots file may carry.
  const { market } = useOrgMarket();
  const { market: catalogue, state: catalogueState } = useCatalogue();
  const crops = importableCrops(catalogue);

  const importFarmersMutation = useMutation({
    mutationFn: (farmers: Record<string, unknown>[]) => api.bulkImportFarmers(farmers),
    onSuccess: (result) => {
      const imported = result?.imported ?? 0;
      const report = buildResultReport(result, "farmers");
      setFarmersReport(report);
      if (report?.tone === "error") {
        notifyError(undefined, report.summary);
      } else if (report) {
        notifySuccess(report.title, report.summary);
      } else {
        notifySuccess("Farmers imported", `Successfully imported ${imported} farmers.`);
      }
      if (imported > 0) {
        setFarmersJson("");
        setFarmersFile(null);
        queryClient.invalidateQueries({ queryKey: ["farmers"] });
        navigate("/org/farmers");
      }
    },
    onError: (error) => {
      setFarmersReport(buildErrorReport(error, "farmers"));
      notifyError(error, "Couldn't import your farmers. Please check the file and try again.");
    },
  });

  const importPlotsMutation = useMutation({
    mutationFn: (plots: Record<string, unknown>[]) => api.bulkImportPlots(plots),
    onSuccess: (result) => {
      const imported = result?.imported ?? 0;
      const report = buildResultReport(result, "plots");
      setPlotsReport(report);
      if (report?.tone === "error") {
        notifyError(undefined, report.summary);
      } else if (report) {
        notifySuccess(report.title, report.summary);
      } else {
        notifySuccess("Plots imported", `Successfully imported ${imported} plots.`);
      }
      if (imported > 0) {
        setPlotsJson("");
        setPlotsFile(null);
      }
    },
    onError: (error) => {
      setPlotsReport(buildErrorReport(error, "plots"));
      notifyError(error, "Couldn't import your plots. Please check the file and try again.");
    },
  });

  const showFarmersClientError = (title: string, message: string) => {
    setFarmersReport({ tone: "error", title, summary: message, issues: [] });
    notifyError(undefined, message);
  };

  const showPlotsClientError = (title: string, message: string) => {
    setPlotsReport({ tone: "error", title, summary: message, issues: [] });
    notifyError(undefined, message);
  };

  const handleCsvImportFarmers = async () => {
    if (!farmersFile) return;
    setFarmersReport(null);
    try {
      const text = await farmersFile.text();
      const { rows, error } = parseCsv(text, {
        normalizeHeader: normalizeFarmerHeader,
        required: FARMER_REQUIRED,
      });
      if (error) return showFarmersClientError("Invalid CSV", error);
      if (rows.length === 0) return showFarmersClientError("Empty file", "CSV file has no data rows.");
      if (rows.length > 500) return showFarmersClientError("Too many rows", "Maximum 500 farmers per import.");
      importFarmersMutation.mutate(rows);
    } catch {
      showFarmersClientError("Parse error", "Failed to read CSV file.");
    }
  };

  const handleCsvImportPlots = async () => {
    if (!plotsFile) return;
    setPlotsReport(null);
    try {
      const text = await plotsFile.text();
      const { rows, error } = parseCsv(text, {
        normalizeHeader: normalizePlotHeader,
        required: PLOT_REQUIRED,
      });
      if (error) return showPlotsClientError("Invalid CSV", error);
      if (rows.length === 0) return showPlotsClientError("Empty file", "CSV file has no data rows.");
      if (rows.length > 500) return showPlotsClientError("Too many rows", "Maximum 500 plots per import.");
      const parsed = rows.map((p) => ({
        ...p,
        latitude: p.latitude ? parseFloat(p.latitude) : undefined,
        longitude: p.longitude ? parseFloat(p.longitude) : undefined,
        acreage: p.acreage ? parseFloat(p.acreage) : undefined,
      }));
      const { plots, blocking } = preparePlotRows(parsed, catalogue, catalogueState);
      if (blocking) {
        setPlotsReport(blocking);
        notifyError(undefined, blocking.summary);
        return;
      }
      importPlotsMutation.mutate(plots);
    } catch {
      showPlotsClientError("Parse error", "Failed to read CSV file.");
    }
  };

  const handleJsonImportFarmers = () => {
    setFarmersReport(null);
    try {
      const parsed = JSON.parse(farmersJson);
      if (!Array.isArray(parsed)) {
        return showFarmersClientError("Invalid format", "Input must be a JSON array.");
      }
      importFarmersMutation.mutate(parsed);
    } catch {
      showFarmersClientError("Invalid JSON", "Please enter valid JSON.");
    }
  };

  const handleJsonImportPlots = () => {
    setPlotsReport(null);
    try {
      const parsed = JSON.parse(plotsJson);
      if (!Array.isArray(parsed)) {
        return showPlotsClientError("Invalid format", "Input must be a JSON array.");
      }
      // The same crop check and field mapping as the CSV path: a pasted array is the same rows.
      const { plots, blocking } = preparePlotRows(parsed, catalogue, catalogueState);
      if (blocking) {
        setPlotsReport(blocking);
        notifyError(undefined, blocking.summary);
        return;
      }
      importPlotsMutation.mutate(plots);
    } catch {
      showPlotsClientError("Invalid JSON", "Please enter valid JSON.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground">Import farmers and plots via CSV or JSON</p>
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
        </TabsList>

        <TabsContent value="farmers" className="space-y-4">
          {farmersReport && (
            <ImportReportPanel report={farmersReport} onDismiss={() => setFarmersReport(null)} />
          )}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Import Farmers (Max 500)</CardTitle>
                  <CardDescription>Upload a CSV file or paste JSON data</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={farmersImportMode === 'csv' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFarmersImportMode('csv')}
                  >
                    CSV File
                  </Button>
                  <Button
                    variant={farmersImportMode === 'json' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFarmersImportMode('json')}
                  >
                    JSON
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {farmersImportMode === 'csv' ? (
                <>
                  <FileDropZone
                    file={farmersFile}
                    onFile={setFarmersFile}
                    accept=".csv,text/csv"
                    label="Upload farmers CSV file"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      onClick={handleCsvImportFarmers}
                      disabled={!farmersFile || importFarmersMutation.isPending}
                    >
                      {importFarmersMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      Import Farmers
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadTemplate(farmerCsvTemplate(market), 'farmers-template.csv')}
                    >
                      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                      Download Template
                    </Button>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Required columns:</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      firstName, lastName, phoneNumber, nationalId, county
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Textarea
                    placeholder={csvToJsonExample(farmerCsvTemplate(market))}
                    rows={10}
                    value={farmersJson}
                    onChange={(e) => setFarmersJson(e.target.value)}
                  />
                  <Button
                    onClick={handleJsonImportFarmers}
                    disabled={!farmersJson.trim() || importFarmersMutation.isPending}
                  >
                    {importFarmersMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Import Farmers
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plots" className="space-y-4">
          {plotsReport && (
            <ImportReportPanel report={plotsReport} onDismiss={() => setPlotsReport(null)} />
          )}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Import Plots (Max 500)</CardTitle>
                  <CardDescription>Upload a CSV file or paste JSON data</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={plotsImportMode === 'csv' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPlotsImportMode('csv')}
                  >
                    CSV File
                  </Button>
                  <Button
                    variant={plotsImportMode === 'json' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPlotsImportMode('json')}
                  >
                    JSON
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {plotsImportMode === 'csv' ? (
                <>
                  <FileDropZone
                    file={plotsFile}
                    onFile={setPlotsFile}
                    accept=".csv,text/csv"
                    label="Upload plots CSV file"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      onClick={handleCsvImportPlots}
                      disabled={!plotsFile || importPlotsMutation.isPending}
                    >
                      {importPlotsMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      Import Plots
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadTemplate(plotCsvTemplate(market, catalogue), 'plots-template.csv')}
                    >
                      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                      Download Template
                    </Button>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Required columns:</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      farmerPhone, plotName, latitude, longitude, acreage, cropType
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Textarea
                    placeholder={csvToJsonExample(plotCsvTemplate(market, catalogue))}
                    rows={10}
                    value={plotsJson}
                    onChange={(e) => setPlotsJson(e.target.value)}
                  />
                  <Button
                    onClick={handleJsonImportPlots}
                    disabled={!plotsJson.trim() || importPlotsMutation.isPending}
                  >
                    {importPlotsMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Import Plots
                  </Button>
                </>
              )}
              {/*
                The cropType values this organization's market accepts, from the catalogue. A
                crop outside this list is refused by the server, so the file is checked against
                it before upload and the offending rows named.
              */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium">
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </CapabilityGate>
    </div>
  );
}
