import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WeatherStation } from "@/types";

/**
 * Where can we actually underwrite?
 *
 * The headline number is deliberately "usable", not "total". A station that exists but
 * reports no data cannot settle a claim, and the gap between the two counts is the
 * number that decides whether a market is viable.
 */
export default function WeatherStationsPage() {
  const [country, setCountry] = useState("KE");

  const { data: markets } = useQuery({
    queryKey: ["weatherMarkets"],
    queryFn: () => api.getWeatherMarkets(),
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["weatherStations", country],
    queryFn: () => api.getWeatherStations(country),
  });

  const summary = data?.summary;
  const threshold = data?.usableThreshold ?? 0.8;

  const stations = [...(data?.stations ?? [])].sort((a, b) => (b.qod ?? 0) - (a.qod ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Weather Station Coverage</h1>
        <p className="text-muted-foreground">
          WeatherXM stations by market. A station counts as usable when its quality score is
          at least {threshold}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(markets ?? []).map((m) => (
          <Button
            key={m.code}
            variant={m.code === country ? "default" : "outline"}
            size="sm"
            onClick={() => setCountry(m.code)}
          >
            {m.name}
          </Button>
        ))}
      </div>

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Could not load stations: {(error as Error)?.message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile
          label="Usable"
          value={summary?.usable}
          hint="reporting data yesterday"
          loading={isLoading}
          emphasis
        />
        <SummaryTile
          label="Not reporting"
          value={summary?.unusable}
          hint="present but unusable for settlement"
          loading={isLoading}
        />
        <SummaryTile
          label="Total stations"
          value={summary?.total}
          hint={summary ? `${summary.usablePct}% usable` : undefined}
          loading={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : stations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stations in this market.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Quality</TableHead>
                    <TableHead className="text-right">Location</TableHead>
                    <TableHead className="text-right">Data since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stations.map((s) => (
                    <StationRow key={s.id} station={s} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  loading,
  emphasis,
}: {
  label: string;
  value?: number;
  hint?: string;
  loading: boolean;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className={emphasis ? "text-3xl font-bold" : "text-3xl font-semibold"}>
            {value ?? "—"}
          </div>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function StationRow({ station }: { station: WeatherStation }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{station.name ?? station.id.slice(0, 8)}</TableCell>
      <TableCell>
        <Badge variant={station.usable ? "default" : "secondary"}>
          {station.usable ? "Reporting" : "No data"}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {typeof station.qod === "number" ? station.qod.toFixed(2) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {typeof station.lat === "number" && typeof station.lon === "number"
          ? `${station.lat.toFixed(3)}, ${station.lon.toFixed(3)}`
          : "—"}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {station.dataSince ? station.dataSince.slice(0, 10) : "—"}
      </TableCell>
    </TableRow>
  );
}
