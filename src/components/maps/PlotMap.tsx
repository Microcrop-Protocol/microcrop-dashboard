import { useEffect, useRef, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import { Plot } from '@/types';
import { Card } from '@/components/ui/card';

interface PlotMapProps {
  plots: Plot[];
  onPlotSelect?: (plot: Plot) => void;
  selectedPlotId?: string;
}

function escapeHtml(str: string): string {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

/**
 * Crop health bands, mirroring NDVI_THRESHOLDS in the backend
 * (microcrop-backend/src/utils/constants.js). Keep the two in step: a map that disagrees
 * with the determination logic is worse than a map with no colour at all.
 */
const NDVI_BANDS = [
  { min: 0.7, label: 'Excellent', color: '#15803d' },
  { min: 0.5, label: 'Good', color: '#22c55e' },
  { min: 0.3, label: 'Moderate', color: '#eab308' },
  { min: 0.2, label: 'Poor', color: '#f97316' },
  { min: -Infinity, label: 'Critical', color: '#dc2626' },
] as const;

const NO_DATA = { label: 'No reading', color: '#94a3b8' } as const;

function healthFor(ndvi: number | null | undefined) {
  if (typeof ndvi !== 'number') return NO_DATA;
  return NDVI_BANDS.find((b) => ndvi >= b.min) ?? NO_DATA;
}

export function PlotMap({ plots, onPlotSelect, selectedPlotId }: PlotMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const mapboxRef = useRef<typeof mapboxgl | null>(null);
  const onSelectRef = useRef(onPlotSelect);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  // Keep callback ref in sync without triggering marker rebuilds
  onSelectRef.current = onPlotSelect;

  // Initialize map instance
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
        mapboxRef.current = mapboxgl;
        mapboxgl.accessToken = token;

        const instance = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: [37.0, -1.0],
          zoom: 6,
        });

        instance.addControl(new mapboxgl.NavigationControl(), 'top-right');
        instance.on('load', () => setMapReady(true));

        map.current = instance;
      } catch (error) {
        if (!cancelled) {
          setMapError('Failed to initialize map');
          console.error('Map initialization error:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      setMapReady(false);
    };
  }, [token]);

  // Sync markers with data — only runs once map is loaded
  useEffect(() => {
    if (!map.current || !mapReady || !mapboxRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (plots.length === 0) return;

    const currentMap = map.current;
    const mb = mapboxRef.current;

    plots.forEach(plot => {
      const isSelected = plot.id === selectedPlotId;

      // Colour carries crop health; size and ring carry selection. Selection must not
      // recolour the marker, or the selected plot would misreport its condition.
      const health = healthFor(plot.latestNdvi);

      const el = document.createElement('div');
      el.className = 'plot-marker';
      el.title = `${plot.name} — ${health.label}`;
      el.style.cssText = `
        width: ${isSelected ? '24px' : '16px'};
        height: ${isSelected ? '24px' : '16px'};
        background-color: ${health.color};
        border: ${isSelected ? '3px' : '2px'} solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3)${isSelected ? ', 0 0 0 2px #0f172a' : ''};
        transition: opacity 0.2s ease;
      `;

      const popup = new mb.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; min-width: 180px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #16a34a;">${escapeHtml(plot.name)}</h4>
          <div style="font-size: 13px; color: #666; line-height: 1.6;">
            <div><strong>Farmer:</strong> ${escapeHtml(plot.farmerName)}</div>
            <div><strong>Crop:</strong> ${escapeHtml(plot.cropType)}</div>
            <div><strong>Acreage:</strong> ${plot.acreage} acres</div>
            ${plot.latestNdvi != null ? `<div><strong>NDVI:</strong> ${plot.latestNdvi.toFixed(2)} <span style="color:${health.color};font-weight:600">${health.label}</span></div>` : `<div style="color:${NO_DATA.color}"><strong>NDVI:</strong> no reading</div>`}
            ${plot.latestTemperature != null ? `<div><strong>Temp:</strong> ${plot.latestTemperature.toFixed(1)}&deg;C</div>` : ''}
            ${plot.latestRainfall != null ? `<div><strong>Rainfall:</strong> ${plot.latestRainfall.toFixed(1)}mm</div>` : ''}
          </div>
        </div>
      `);

      const marker = new mb.Marker(el)
        .setLngLat([Number(plot.longitude), Number(plot.latitude)])
        .setPopup(popup)
        .addTo(currentMap);

      el.addEventListener('click', () => {
        onSelectRef.current?.(plot);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all plots
    if (plots.length > 1) {
      const bounds = new mb.LngLatBounds();
      plots.forEach(plot => bounds.extend([Number(plot.longitude), Number(plot.latitude)]));
      currentMap.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    } else if (plots.length === 1) {
      currentMap.flyTo({
        center: [Number(plots[0].longitude), Number(plots[0].latitude)],
        zoom: 14,
      });
    }
  }, [plots, selectedPlotId, mapReady]);

  if (mapError) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🗺️</div>
          <h3 className="font-semibold text-lg mb-2">Map Unavailable</h3>
          <p className="text-muted-foreground text-sm">{mapError}</p>
          <p className="text-muted-foreground text-xs mt-2">
            Set VITE_MAPBOX_TOKEN in your .env file to enable
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative h-full w-full" style={{ minHeight: '400px' }}>
      <div ref={mapContainer} className="h-full w-full rounded-lg overflow-hidden" />
      <HealthLegend hasPlots={plots.length > 0} />
    </div>
  );
}

/** Without this the colour ramp is guesswork. */
function HealthLegend({ hasPlots }: { hasPlots: boolean }) {
  if (!hasPlots) return null;

  return (
    <div className="absolute bottom-3 left-3 rounded-md bg-background/90 px-3 py-2 text-xs shadow-md backdrop-blur">
      <div className="mb-1 font-medium text-muted-foreground">Crop health (NDVI)</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {[...NDVI_BANDS, NO_DATA].map((b) => (
          <span key={b.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full border border-white"
              style={{ backgroundColor: b.color }}
            />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
