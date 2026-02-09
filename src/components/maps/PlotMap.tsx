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

      const el = document.createElement('div');
      el.className = 'plot-marker';
      el.style.cssText = `
        width: ${isSelected ? '24px' : '16px'};
        height: ${isSelected ? '24px' : '16px'};
        background-color: ${isSelected ? '#16a34a' : '#22c55e'};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
      `;

      const popup = new mb.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; min-width: 180px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #16a34a;">${escapeHtml(plot.name)}</h4>
          <div style="font-size: 13px; color: #666; line-height: 1.6;">
            <div><strong>Farmer:</strong> ${escapeHtml(plot.farmerName)}</div>
            <div><strong>Crop:</strong> ${escapeHtml(plot.cropType)}</div>
            <div><strong>Acreage:</strong> ${plot.acreage} acres</div>
            ${plot.latestNdvi != null ? `<div><strong>NDVI:</strong> ${plot.latestNdvi.toFixed(2)}</div>` : ''}
            ${plot.latestTemperature != null ? `<div><strong>Temp:</strong> ${plot.latestTemperature.toFixed(1)}&deg;C</div>` : ''}
            ${plot.latestRainfall != null ? `<div><strong>Rainfall:</strong> ${plot.latestRainfall.toFixed(1)}mm</div>` : ''}
          </div>
        </div>
      `);

      const marker = new mb.Marker(el)
        .setLngLat([plot.longitude, plot.latitude])
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
      plots.forEach(plot => bounds.extend([plot.longitude, plot.latitude]));
      currentMap.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    } else if (plots.length === 1) {
      currentMap.flyTo({
        center: [plots[0].longitude, plots[0].latitude],
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
    <div
      ref={mapContainer}
      className="h-full w-full rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    />
  );
}
