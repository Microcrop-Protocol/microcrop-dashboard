import { useQuery } from "@tanstack/react-query";
import { Loader2, PackageSearch } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MarketSelect } from "@/components/platform/MarketSelect";
import { useMarketFilter } from "@/hooks/useMarketFilter";
import {
  CATALOGUE_LINES,
  CATALOGUE_LINE_LABELS,
  catalogueStatusLabel,
  catalogueStatusVariant,
  sortCatalogueItems,
  summarizeCatalogueMarket,
} from "@/lib/platform-catalogue";
import { catalogueReasonLabel } from "@/lib/catalogue";
import type { CatalogueItem, CatalogueLine, CatalogueMarket } from "@/types/catalogue";

function CatalogueLineTable({
  line,
  items,
  countryName,
}: {
  line: CatalogueLine;
  items: CatalogueItem[];
  countryName: string;
}) {
  const label = CATALOGUE_LINE_LABELS[line];
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No {label.toLowerCase()} products are offered in {countryName}.
      </p>
    );
  }

  const showTlu = line === "LIVESTOCK";
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table aria-label={`${countryName} ${label.toLowerCase()} products`}>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sellable</TableHead>
            <TableHead>Peril</TableHead>
            <TableHead>Index</TableHead>
            <TableHead>Cover period</TableHead>
            <TableHead>Insurable unit</TableHead>
            {showTlu && <TableHead>TLU factor</TableHead>}
            <TableHead>Precedent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortCatalogueItems(items).map((item) => (
            <TableRow key={item.code}>
              <TableCell>
                <div className="font-medium">{item.label}</div>
                <div className="font-mono text-xs text-muted-foreground">{item.code}</div>
              </TableCell>
              <TableCell>
                <StatusBadge variant={catalogueStatusVariant(item.status)}>
                  {catalogueStatusLabel(item.status)}
                </StatusBadge>
              </TableCell>
              <TableCell>
                {item.sellable ? "Yes" : "No"}
                {/* The server's reason a PILOT/AVAILABLE item is not sellable (e.g. unpriced). */}
                {!item.sellable && catalogueReasonLabel(item.reason) && (
                  <div className="text-xs text-muted-foreground">{catalogueReasonLabel(item.reason)}</div>
                )}
              </TableCell>
              <TableCell className="min-w-[10rem] text-sm">{item.peril}</TableCell>
              <TableCell className="min-w-[12rem] text-sm">{item.index}</TableCell>
              <TableCell className="text-sm">{item.coverPeriod}</TableCell>
              <TableCell className="text-sm">{item.insurableUnit}</TableCell>
              {showTlu && (
                <TableCell className="tabular-nums">
                  {typeof item.tluFactor === "number" ? item.tluFactor : "—"}
                </TableCell>
              )}
              <TableCell className="text-sm">{item.precedent}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CatalogueMarketCard({ market }: { market: CatalogueMarket }) {
  const summary = summarizeCatalogueMarket(market);
  return (
    <Card data-testid={`catalogue-${market.countryCode}`}>
      <CardHeader>
        <CardTitle className="text-base">
          {market.countryName} · {market.currency}
        </CardTitle>
        <CardDescription>
          {summary.crop} crop · {summary.livestock} livestock · {summary.sellable} sellable
          {summary.comingSoon > 0 ? ` · ${summary.comingSoon} coming soon` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {CATALOGUE_LINES.map((line) => (
          <section key={line} className="space-y-2">
            <h3 className="text-sm font-semibold">{CATALOGUE_LINE_LABELS[line]}</h3>
            <CatalogueLineTable
              line={line}
              items={market.lines?.[line] ?? []}
              countryName={market.countryName}
            />
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * The product catalogue per market, read-only. AVAILABLE and PILOT items can be quoted and sold;
 * COMING_SOON items are listed but refused at quote; anything not listed cannot be used for a new
 * plot, herd or policy in that market. Edited in the backend's config/catalogue.js, not here.
 */
export default function CataloguePage() {
  const { value: marketFilter, setValue: setMarketFilter, countryCode, market } = useMarketFilter("any");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => api.getCatalogue(),
    staleTime: 5 * 60 * 1000,
  });

  const markets = (data?.markets ?? []).filter(
    (m) => !countryCode || m.countryCode.toUpperCase() === countryCode,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Catalogue</h1>
          <p className="text-muted-foreground">
            What each market offers. Available and Pilot products can be quoted and sold; Coming
            soon products are listed but not sellable.
          </p>
        </div>
        <MarketSelect mode="any" value={marketFilter} onChange={setMarketFilter} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading catalogue" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            We couldn't load the product catalogue. Please try again.
          </CardContent>
        </Card>
      ) : markets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <PackageSearch className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
            No catalogue was returned for {market ? market.countryName : "any market"}.
          </CardContent>
        </Card>
      ) : (
        markets.map((m) => <CatalogueMarketCard key={m.countryCode} market={m} />)
      )}
    </div>
  );
}
