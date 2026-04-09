import { useState, useRef, useEffect, useCallback } from 'react';
import type mapboxgl from 'mapbox-gl';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Navigation, AlertTriangle, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { GpsPoint, GpsTrackResponse } from '@/types';

interface BoundaryWalkStepProps {
  plotId: string;
  onComplete: (result: GpsTrackResponse) => void;
}

type WalkState = 'idle' | 'requesting' | 'tracking' | 'submitting';

export function BoundaryWalkStep({ plotId, onComplete }: BoundaryWalkStepProps) {
  const { toast } = useToast();
  const [walkState, setWalkState] = useState<WalkState>('idle');
  const [pointCount, setPointCount] = useState(0);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [hasBackup, setHasBackup] = useState(false);

  const isMountedRef = useRef(true);
  const walkStateRef = useRef<WalkState>('idle');
  const pointsRef = useRef<GpsPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapboxModuleRef = useRef<typeof mapboxgl | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const submitMutation = useMutation({
    mutationFn: (points: GpsPoint[]) =>
      api.submitGpsTrack(plotId, { points, accuracyThreshold: 15 }),
    onSuccess: (result) => {
      sessionStorage.removeItem('gps-walk-backup');
      onComplete(result);
    },
    onError: (error: Error) => {
      walkStateRef.current = 'idle';
      setWalkState('idle');
      toast({ title: 'Boundary submission failed', description: error.message, variant: 'destructive' });
    },
  });

  // Initialize mini-map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const mb = await import('mapbox-gl');
        await import('mapbox-gl/dist/mapbox-gl.css');
        if (cancelled) return;
        const mapboxgl = mb.default;
        mapboxModuleRef.current = mapboxgl;
        mapboxgl.accessToken = token;
        const instance = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: [37.0, -1.0],
          zoom: 6,
        });
        instance.addControl(new mapboxgl.NavigationControl(), 'top-right');
        mapRef.current = instance;
      } catch {
        // Map initialization failed — GPS tracking still works without the map
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map markers and path
  const updateMap = useCallback((points: GpsPoint[]) => {
    if (!mapRef.current || !mapboxModuleRef.current || points.length === 0) return;
    const mb = mapboxModuleRef.current;
    const currentMap = mapRef.current;
    const lastPoint = points[points.length - 1];

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add point markers
    points.forEach((pt, i) => {
      const isLatest = i === points.length - 1;
      const el = document.createElement('div');
      el.style.cssText = `
        width: ${isLatest ? '12px' : '6px'};
        height: ${isLatest ? '12px' : '6px'};
        background: ${isLatest ? '#22c55e' : '#3b82f6'};
        border-radius: 50%;
        border: 1px solid white;
        pointer-events: none;
      `;
      const marker = new mb.Marker(el).setLngLat([pt.lon, pt.lat]).addTo(currentMap);
      markersRef.current.push(marker);
    });

    // Draw/update path line
    const lineData: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: points.map(p => [p.lon, p.lat]),
      },
      properties: {},
    };

    const source = currentMap.getSource('walk-path') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(lineData);
    } else if (currentMap.isStyleLoaded()) {
      currentMap.addSource('walk-path', { type: 'geojson', data: lineData });
      currentMap.addLayer({
        id: 'walk-path-line',
        type: 'line',
        source: 'walk-path',
        paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [2, 2] },
      });
    }

    // Center on latest point
    currentMap.flyTo({
      center: [lastPoint.lon, lastPoint.lat],
      zoom: Math.max(currentMap.getZoom(), 16),
    });
  }, []);

  const startWalk = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsError(null);
    pointsRef.current = [];
    setPointCount(0);
    setElapsed(0);
    walkStateRef.current = 'requesting';
    setWalkState('requesting');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!isMountedRef.current) return;
        if (walkStateRef.current === 'requesting') {
          walkStateRef.current = 'tracking';
          setWalkState('tracking');
          startTimeRef.current = Date.now();
          timerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
          }, 1000);
        }

        const point: GpsPoint = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        };

        pointsRef.current.push(point);
        setPointCount(pointsRef.current.length);
        setLastAccuracy(position.coords.accuracy);

        // Update map every 3 points to limit DOM churn
        if (pointsRef.current.length % 3 === 0 || pointsRef.current.length <= 3) {
          updateMap([...pointsRef.current]);
        }

        // Save backup every 10 points
        if (pointsRef.current.length % 10 === 0) {
          try {
            sessionStorage.setItem('gps-walk-backup', JSON.stringify(pointsRef.current));
          } catch {
            // Storage full or unavailable — ignore
          }
        }
      },
      (error) => {
        walkStateRef.current = 'idle';
        setWalkState('idle');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Location permission denied. Please enable location access in your browser settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Location information unavailable. Make sure GPS is enabled on this device.');
            break;
          case error.TIMEOUT:
            setGpsError('Location request timed out. Please try again in an open area.');
            break;
          default:
            setGpsError('An unknown error occurred while accessing your location.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }, [updateMap]);

  const stopWalk = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const points = [...pointsRef.current];
    if (points.length < 4) {
      toast({
        title: 'Not enough points',
        description: `At least 4 GPS points are required but only ${points.length} were collected. Walk for longer to collect more.`,
        variant: 'destructive',
      });
      walkStateRef.current = 'idle';
      setWalkState('idle');
      return;
    }

    walkStateRef.current = 'submitting';
    setWalkState('submitting');
    updateMap(points);
    submitMutation.mutate(points);
  }, [submitMutation, toast, updateMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Check for backup walk data on mount
  useEffect(() => {
    const backup = sessionStorage.getItem('gps-walk-backup');
    if (backup) {
      try {
        const points = JSON.parse(backup) as GpsPoint[];
        if (points.length >= 4) setHasBackup(true);
      } catch {
        sessionStorage.removeItem('gps-walk-backup');
      }
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAccuracyInfo = (accuracy: number) => {
    if (accuracy <= 5) return { color: 'text-green-600', label: 'Excellent' };
    if (accuracy <= 10) return { color: 'text-yellow-600', label: 'Good' };
    if (accuracy <= 15) return { color: 'text-orange-600', label: 'Fair' };
    return { color: 'text-red-600', label: 'Poor' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Walk Plot Boundary</CardTitle>
        <CardDescription>
          Walk around the perimeter of the plot while GPS tracks your path
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {gpsError && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
            <div className="flex gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{gpsError}</span>
            </div>
          </div>
        )}

        {hasBackup && walkState === 'idle' && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700 dark:text-blue-300">Previous walk data found.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  sessionStorage.removeItem('gps-walk-backup');
                  setHasBackup(false);
                }}>Discard</Button>
                <Button size="sm" onClick={() => {
                  const backup = sessionStorage.getItem('gps-walk-backup');
                  if (backup) {
                    const points = JSON.parse(backup) as GpsPoint[];
                    pointsRef.current = points;
                    setPointCount(points.length);
                    updateMap([...points]);
                    sessionStorage.removeItem('gps-walk-backup');
                    setHasBackup(false);
                  }
                }}>Restore Points</Button>
              </div>
            </div>
          </div>
        )}

        {walkState === 'idle' && !gpsError && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Instructions</h4>
            <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
              <li>Stand at any corner of the plot</li>
              <li>Tap &quot;Start Walking&quot; below</li>
              <li>Walk slowly along the entire plot boundary</li>
              <li>Return close to the starting point</li>
              <li>Tap &quot;Stop Walking&quot; when finished</li>
            </ol>
          </div>
        )}

        {/* Mini map */}
        <div
          ref={mapContainerRef}
          className="rounded-lg overflow-hidden border bg-muted"
          style={{ height: walkState === 'tracking' ? '300px' : '200px', transition: 'height 0.3s ease' }}
          role="img"
          aria-label="GPS boundary walk map showing collected points"
        />

        {/* Live stats during tracking */}
        {walkState === 'tracking' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold tabular-nums">{pointCount}</div>
              <div className="text-xs text-muted-foreground">Points</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className={`text-2xl font-bold tabular-nums ${lastAccuracy != null ? getAccuracyInfo(lastAccuracy).color : ''}`}>
                {lastAccuracy != null ? `${lastAccuracy.toFixed(1)}m` : '--'}
              </div>
              <div className="text-xs text-muted-foreground">
                Accuracy{lastAccuracy != null ? ` · ${getAccuracyInfo(lastAccuracy).label}` : ''}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold tabular-nums">{formatTime(elapsed)}</div>
              <div className="text-xs text-muted-foreground">Elapsed</div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {walkState === 'idle' && (
          <Button className="w-full" onClick={startWalk} size="lg">
            <Navigation className="mr-2 h-4 w-4" />
            Start Walking
          </Button>
        )}
        {walkState === 'requesting' && (
          <Button className="w-full" disabled size="lg">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Requesting GPS access...
          </Button>
        )}
        {walkState === 'tracking' && (
          <Button className="w-full" variant="destructive" onClick={stopWalk} size="lg">
            <Pause className="mr-2 h-4 w-4" />
            Stop Walking ({pointCount} points)
          </Button>
        )}
        {walkState === 'submitting' && (
          <Button className="w-full" disabled size="lg">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Processing boundary...
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
