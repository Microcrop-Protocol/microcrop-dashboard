import { useCallback, useEffect, useRef, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import { DamageAssessment } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Map, Satellite } from 'lucide-react';

interface DamageHeatmapProps {
  assessments: DamageAssessment[];
  onAssessmentSelect?: (assessment: DamageAssessment) => void;
  selectedAssessmentId?: string;
}

const MAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets: 'mapbox://styles/mapbox/dark-v11',
} as const;

type MapStyle = keyof typeof MAP_STYLES;

function escapeHtml(str: string): string {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function getDamageColor(score: number): string {
  if (score < 0.3) return '#22c55e';
  if (score < 0.6) return '#eab308';
  return '#ef4444';
}

function getDamageLabel(score: number): string {
  if (score < 0.3) return 'Healthy';
  if (score < 0.6) return 'Moderate';
  return 'Severe';
}

export function DamageHeatmap({ assessments, onAssessmentSelect, selectedAssessmentId }: DamageHeatmapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const mapboxRef = useRef<typeof mapboxgl | null>(null);
  const onSelectRef = useRef(onAssessmentSelect);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('satellite');

  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  // Keep callback ref in sync without triggering marker rebuilds
  onSelectRef.current = onAssessmentSelect;

  const toggleMapStyle = useCallback(() => {
    setMapStyle(prev => {
      const next = prev === 'satellite' ? 'streets' : 'satellite';
      map.current?.setStyle(MAP_STYLES[next]);
      return next;
    });
  }, []);

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
          style: MAP_STYLES['satellite'],
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

    if (assessments.length === 0) return;

    const currentMap = map.current;
    const mb = mapboxRef.current;

    assessments.forEach(assessment => {
      const isSelected = assessment.id === selectedAssessmentId;
      const color = getDamageColor(assessment.combinedDamageScore);
      const label = getDamageLabel(assessment.combinedDamageScore);

      const el = document.createElement('div');
      el.className = 'damage-marker';
      el.style.cssText = `
        width: ${isSelected ? '28px' : '20px'};
        height: ${isSelected ? '28px' : '20px'};
        background-color: ${color};
        border: 3px solid ${isSelected ? 'white' : 'rgba(255,255,255,0.7)'};
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 ${isSelected ? '12px' : '8px'} ${color}80;
        transition: all 0.2s ease;
      `;

      const popup = new mb.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color};"></div>
            <h4 style="font-weight: 600; margin: 0;">${escapeHtml(assessment.policyNumber)}</h4>
          </div>
          <div style="font-size: 13px; color: #666; line-height: 1.6;">
            <div><strong>Plot:</strong> ${escapeHtml(assessment.plotName)}</div>
            <div><strong>Status:</strong> <span style="color: ${color}; font-weight: 500;">${escapeHtml(label)}</span></div>
            <div><strong>Combined Damage:</strong> ${(assessment.combinedDamageScore * 100).toFixed(0)}%</div>
            <div><strong>Weather Score:</strong> ${(assessment.weatherDamageScore * 100).toFixed(0)}%</div>
            <div><strong>Satellite Score:</strong> ${(assessment.satelliteDamageScore * 100).toFixed(0)}%</div>
            <div><strong>Triggered:</strong> ${assessment.isTriggered ? '&#10003; Yes' : '&#10007; No'}</div>
          </div>
        </div>
      `);

      const marker = new mb.Marker(el)
        .setLngLat([assessment.longitude, assessment.latitude])
        .setPopup(popup)
        .addTo(currentMap);

      el.addEventListener('click', () => {
        onSelectRef.current?.(assessment);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all assessments
    if (assessments.length > 1) {
      const bounds = new mb.LngLatBounds();
      assessments.forEach(a => bounds.extend([a.longitude, a.latitude]));
      currentMap.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    } else if (assessments.length === 1) {
      currentMap.flyTo({
        center: [assessments[0].longitude, assessments[0].latitude],
        zoom: 14,
      });
    }
  }, [assessments, selectedAssessmentId, mapReady]);

  if (mapError) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🌡️</div>
          <h3 className="font-semibold text-lg mb-2">Heatmap Unavailable</h3>
          <p className="text-muted-foreground text-sm">{mapError}</p>
          <p className="text-muted-foreground text-xs mt-2">
            Set VITE_MAPBOX_TOKEN in your .env file to enable
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={mapContainer}
        className="h-full w-full rounded-lg overflow-hidden"
        style={{ minHeight: '400px' }}
      />

      {/* Map Style Toggle */}
      <div className="absolute top-4 left-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleMapStyle}
          className="bg-background/90 backdrop-blur-sm shadow-lg"
        >
          {mapStyle === 'satellite' ? (
            <>
              <Map className="h-4 w-4 mr-2" />
              Streets
            </>
          ) : (
            <>
              <Satellite className="h-4 w-4 mr-2" />
              Satellite
            </>
          )}
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border">
        <div className="text-xs font-medium mb-2">Damage Level</div>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>0-30% Healthy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>30-60% Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>60-100% Severe</span>
          </div>
        </div>
      </div>
    </div>
  );
}
