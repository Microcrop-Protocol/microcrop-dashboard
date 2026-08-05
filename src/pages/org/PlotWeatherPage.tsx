import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Can this plot be covered?
 *
 * The verdict is driven by whether a REPORTING station is within range, not by whether
 * a station exists nearby. Writing a policy against a station that is dark means a claim
 * we cannot settle.
 */
export default function PlotWeatherPage() {
  const { plotId } = useParams<{ plotId: string }>();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["plotWeatherCoverage", plotId],
    queryFn: () => api.getPlotWeatherCoverage(plotId as string),
    enabled: Boolean(plotId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Could not load coverage: {(error as Error)?.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const stale =
    data.assignedStationId !== null && data.assignedStationStillUsable === false;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/org/plots" className="text-sm text-muted-foreground hover:underline">
          ← Plots
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{data.plot.name}</h1>
        <p className="text-muted-foreground tabular-nums">
          {data.plot.lat.toFixed(4)}, {data.plot.lon.toFixed(4)} · searched{" "}
          {data.radiusKm} km
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <Badge variant={data.covered ? "default" : "destructive"} className="text-sm">
            {data.covered ? "Coverage available" : "No usable coverage"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {data.usableInRange} reporting of {data.stationsInRange} in range
          </span>
          {data.nearestUsable && (
            <span className="text-sm text-muted-foreground">
              nearest reporting: {data.nearestUsable.name ?? data.nearestUsable.id.slice(0, 8)} at{" "}
              {data.nearestUsable.distanceKm} km
            </span>
          )}
        </CardContent>
      </Card>

      {stale && (
        <Alert variant="destructive">
          <AlertDescription>
            This plot is bound to station <code>{data.assignedStationId}</code>, which is no
            longer reporting. Any index built on it will not settle. Reassign before writing
            new cover.
          </AlertDescription>
        </Alert>
      )}

      {!data.covered && data.stationsInRange > 0 && (
        <Alert>
          <AlertDescription>
            There are {data.stationsInRange} stations within {data.radiusKm} km but none are
            reporting usable data. Presence is not coverage.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stations in range</CardTitle>
        </CardHeader>
        <CardContent>
          {data.stations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stations within {data.radiusKm} km.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Distance</TableHead>
                    <TableHead className="text-right">Quality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stations.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        {s.name ?? s.id.slice(0, 8)}
                        {s.id === data.assignedStationId && (
                          <Badge variant="outline" className="ml-2">
                            assigned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.usable ? "default" : "secondary"}>
                          {s.usable ? "Reporting" : "No data"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.distanceKm ?? "—"} km
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.qod.toFixed(2)}
                      </TableCell>
                    </TableRow>
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
