import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DamageAssessment } from '@/types';
import { Card } from '@/components/ui/card';

interface DamageHeatmapProps {
  assessments: DamageAssessment[];
  onAssessmentSelect?: (assessment: DamageAssessment) => void;
  selectedAssessmentId?: string;
}

function getDamageColor(score: number): string {
  // 0-30% green (healthy), 30-60% yellow (moderate), 60-100% red (severe)
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
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [37.0, -1.0],
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

    if (assessments.length === 0) return;

    // Add markers for each assessment
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

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color};"></div>
            <h4 style="font-weight: 600; margin: 0;">${assessment.policyNumber}</h4>
          </div>
          <div style="font-size: 13px; color: #666; line-height: 1.6;">
            <div><strong>Plot:</strong> ${assessment.plotName}</div>
            <div><strong>Status:</strong> <span style="color: ${color}; font-weight: 500;">${label}</span></div>
            <div><strong>Combined Damage:</strong> ${(assessment.combinedDamageScore * 100).toFixed(0)}%</div>
            <div><strong>Weather Score:</strong> ${(assessment.weatherDamageScore * 100).toFixed(0)}%</div>
            <div><strong>Satellite Score:</strong> ${(assessment.satelliteDamageScore * 100).toFixed(0)}%</div>
            <div><strong>Triggered:</strong> ${assessment.isTriggered ? '✓ Yes' : '✗ No'}</div>
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([assessment.longitude, assessment.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener('click', () => {
        onAssessmentSelect?.(assessment);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all assessments
    if (assessments.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      assessments.forEach(a => bounds.extend([a.longitude, a.latitude]));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    } else if (assessments.length === 1) {
      map.current.flyTo({
        center: [assessments[0].longitude, assessments[0].latitude],
        zoom: 14,
      });
    }
  }, [assessments, selectedAssessmentId, onAssessmentSelect, token]);

  if (mapError) {
    return (
      <Card className="h-full flex items-center justify-center bg-muted">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">🌡️</div>
          <h3 className="font-semibold text-lg mb-2">Heatmap Unavailable</h3>
          <p className="text-muted-foreground text-sm">{mapError}</p>
          <p className="text-muted-foreground text-xs mt-2">
            Add MAPBOX_TOKEN to secrets to enable
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
