import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Plot } from '@/types';
import { Card } from '@/components/ui/card';

interface PlotMapProps {
  plots: Plot[];
  onPlotSelect?: (plot: Plot) => void;
  selectedPlotId?: string;
}

export function PlotMap({ plots, onPlotSelect, selectedPlotId }: PlotMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!mapContainer.current) return;
    
    if (!token) {
      setMapError('Mapbox token not configured');
      return;
    }

    mapboxgl.accessToken = token;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [37.0, -1.0], // Kenya center
        zoom: 6,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    } catch (error) {
      setMapError('Failed to initialize map');
      console.error('Map initialization error:', error);
    }

    return () => {
      map.current?.remove();
    };
  }, [token]);

  useEffect(() => {
    if (!map.current || !token) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (plots.length === 0) return;

    // Add markers for each plot
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

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; min-width: 180px;">
          <h4 style="font-weight: 600; margin-bottom: 8px; color: #16a34a;">${plot.name}</h4>
          <div style="font-size: 13px; color: #666; line-height: 1.6;">
            <div><strong>Farmer:</strong> ${plot.farmerName}</div>
            <div><strong>Crop:</strong> ${plot.cropType}</div>
            <div><strong>Acreage:</strong> ${plot.acreage} acres</div>
            ${plot.latestNdvi ? `<div><strong>NDVI:</strong> ${plot.latestNdvi.toFixed(2)}</div>` : ''}
            ${plot.latestTemperature ? `<div><strong>Temp:</strong> ${plot.latestTemperature.toFixed(1)}°C</div>` : ''}
            ${plot.latestRainfall ? `<div><strong>Rainfall:</strong> ${plot.latestRainfall.toFixed(1)}mm</div>` : ''}
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([plot.longitude, plot.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener('click', () => {
        onPlotSelect?.(plot);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all plots
    if (plots.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      plots.forEach(plot => bounds.extend([plot.longitude, plot.latitude]));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    } else if (plots.length === 1) {
      map.current.flyTo({
        center: [plots[0].longitude, plots[0].latitude],
        zoom: 14,
      });
    }
  }, [plots, selectedPlotId, onPlotSelect, token]);

  if (mapError) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🗺️</div>
          <h3 className="font-semibold text-lg mb-2">Map Unavailable</h3>
          <p className="text-muted-foreground text-sm">{mapError}</p>
          <p className="text-muted-foreground text-xs mt-2">
            Add MAPBOX_TOKEN to secrets to enable
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
