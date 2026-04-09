import { useEffect, useRef, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { GeoJsonPolygon } from '@/types';
import { Card } from '@/components/ui/card';

interface BoundaryReviewMapProps {
  boundary: GeoJsonPolygon;
  centroidLat: number;
  centroidLon: number;
}

export function BoundaryReviewMap({ boundary, centroidLat, centroidLon }: BoundaryReviewMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!token) {
      setMapError('Mapbox token not configured');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const mb = await import('mapbox-gl');
        await import('mapbox-gl/dist/mapbox-gl.css');
        if (cancelled) return;

        const mapboxgl = mb.default;
        mapboxgl.accessToken = token;

        const instance = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: [centroidLon, centroidLat],
          zoom: 15,
        });

        instance.addControl(new mapboxgl.NavigationControl(), 'top-right');

        instance.on('load', () => {
          instance.addSource('plot-boundary', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: boundary,
              properties: {},
            },
          });

          instance.addLayer({
            id: 'plot-boundary-fill',
            type: 'fill',
            source: 'plot-boundary',
            paint: {
              'fill-color': '#22c55e',
              'fill-opacity': 0.2,
            },
          });

          instance.addLayer({
            id: 'plot-boundary-line',
            type: 'line',
            source: 'plot-boundary',
            paint: {
              'line-color': '#16a34a',
              'line-width': 3,
            },
          });

          // Fit map to boundary
          const coords = boundary.coordinates[0];
          if (coords && coords.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();
            coords.forEach(coord => bounds.extend([coord[0], coord[1]] as [number, number]));
            instance.fitBounds(bounds, { padding: 50 });
          }
        });

        map.current = instance;
      } catch {
        if (!cancelled) setMapError('Failed to initialize map');
      }
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [boundary, centroidLat, centroidLon, token]);

  if (mapError) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted">
        <div className="text-center p-8">
          <h3 className="font-semibold text-lg mb-2">Map Unavailable</h3>
          <p className="text-muted-foreground text-sm">{mapError}</p>
          <p className="text-muted-foreground text-xs mt-2">
            Set VITE_MAPBOX_TOKEN in your .env file to enable maps
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div
      ref={mapContainer}
      className="h-full w-full rounded-lg overflow-hidden"
      role="img"
      aria-label="Plot boundary polygon map"
    />
  );
}
