import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ColumnDef } from "@tanstack/react-table";
import { InsuranceUnit } from "@/types";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { CreateInsuranceUnitDialog } from "@/components/platform/CreateInsuranceUnitDialog";
import { MarketSelect } from "@/components/platform/MarketSelect";
import { notifySuccess, notifyError } from "@/lib/notify";
import { useMarketFilter } from "@/hooks/useMarketFilter";
import { divisionLabelForFilter, type MarketFilter } from "@/lib/market-filter";
import { formatMoney, marketOrNull } from "@/lib/market";
import { seasonShortLabel } from "@/lib/insurance-unit-market";

// NDVI baselines & premium rates are Prisma Decimals that arrive as strings and
// may be null on sparse rows — render an em dash instead of a literal "NaN".
const fmtDecimal = (value: unknown, digits: number): string => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
};

// A unit's rates are in ITS market's currency, which may differ row to row on the "All markets"
// view — so each row is labelled from its own `country`, and an unknown one is left unlabelled.
// Two decimals: a per-TLU rate is a configured price (e.g. 1,512.50), and rounding it to whole
// units showed the operator a rate that is not the one the unit charges.
const fmtRate = (value: unknown, country: string): string => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? formatMoney(n, marketOrNull(country), { decimals: 2 }) : "—";
};

function seasonColumn(season: "LRLD" | "SRSD"): ColumnDef<InsuranceUnit> {
  const baseline = season === "LRLD" ? "ndviBaselineLRLD" : "ndviBaselineSRSD";
  const rate = season === "LRLD" ? "premiumRateLRLD" : "premiumRateSRSD";
  return {
    id: season,
    header: `${season} Season`,
    cell: ({ row }) => (
      <div className="text-sm">
        <div className="text-xs text-muted-foreground">{seasonShortLabel(row.original.country, season)}</div>
        <div>Base: {fmtDecimal(row.original[baseline], 3)}</div>
        <div className="text-muted-foreground">Rate/TLU: {fmtRate(row.original[rate], row.original.country)}</div>
      </div>
    ),
  };
}

function buildColumns(filter: MarketFilter): ColumnDef<InsuranceUnit>[] {
  return [
    {
      accessorKey: "country",
      header: "Country",
      cell: ({ row }) => marketOrNull(row.original.country)?.countryName ?? row.original.country,
    },
    {
      accessorKey: "county",
      header: divisionLabelForFilter(filter),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.getValue("county")}</div>
          {row.original.subCounty && (
            <div className="text-sm text-muted-foreground">{row.original.subCounty}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "unitCode",
      header: "Unit Code",
    },
    seasonColumn("LRLD"),
    seasonColumn("SRSD"),
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={row.getValue("isActive") ? "active" : "expired"}>
          {row.getValue("isActive") ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatDate(row.getValue("createdAt")),
    },
  ];
}

export default function InsuranceUnitsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { value: marketFilter, setValue: setMarketFilter, countryCode } = useMarketFilter("any");
  const columns = useMemo(() => buildColumns(marketFilter), [marketFilter]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["insurance-units", countryCode ?? "ALL"],
    // Filtered server-side: the list endpoint declares `country`, so a Ghana view never pages
    // through Kenyan units to find its own.
    queryFn: () => api.getInsuranceUnits(countryCode ? { country: countryCode } : undefined),
  });

  const createMutation = useMutation({
    // The dialog assembles bbox from four labeled coordinate inputs into the
    // [minLon, minLat, maxLon, maxLat] array the API expects (or omits it).
    mutationFn: (data: Parameters<typeof api.createInsuranceUnit>[0]) => {
      return api.createInsuranceUnit(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance-units"] });
      notifySuccess("Insurance unit created", "Successfully created the new coverage region.");
    },
    onError: (err) => {
      notifyError(err, "Couldn't create the insurance unit.");
    }
  });

  const toArray = <T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object") {
      const maybeData = (value as { data?: unknown }).data;
      if (Array.isArray(maybeData)) return maybeData as T[];
    }
    return [];
  };

  const units = toArray<InsuranceUnit>(data?.data);

  const filteredData = units.filter((unit) => {
    const matchesSearch =
      search === "" ||
      unit.county.toLowerCase().includes(search.toLowerCase()) ||
      unit.unitCode.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Insurance Units</h1>
          <p className="text-muted-foreground">
            Geographic units for the livestock forage index, per market
          </p>
        </div>
        <CreateInsuranceUnitDialog
          onSubmit={async (data) => {
            await createMutation.mutateAsync(data);
          }}
          isLoading={createMutation.isPending}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
        <MarketSelect mode="any" value={marketFilter} onChange={setMarketFilter} />
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search regions or codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Search units"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Table */}
      {isError ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          We couldn't load insurance units. Please try again.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredData}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
