import { Map as MapLibreMap, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef } from 'react';
import type { Bounds } from '../app/overlay';

// MapLibre 6 ships its worker as a separate module, so the bundler has to emit it.
setWorkerUrl(workerUrl);

export interface View {
  bounds: Bounds;
  zoom: number;
}

interface Props {
  style: StyleSpecification;
  center: [number, number];
  zoom: number;
  onReady: (map: MapLibreMap) => void;
  onView: (view: View) => void;
  /** The map has finished drawing at this zoom. */
  onIdle: (zoom: number) => void;
}

const THROTTLE_MS = 250;

export function MapView({ style, center, zoom, onReady, onView, onIdle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const appliedStyle = useRef<StyleSpecification | null>(null);
  // Handlers can change every render; the map is created once, so it reads them through a ref.
  const handlers = useRef({ onReady, onView, onIdle });
  useEffect(() => {
    handlers.current = { onReady, onView, onIdle };
  });
  const initial = useRef({ style, center, zoom });

  useEffect(() => {
    const map = new MapLibreMap({
      container: containerRef.current!,
      style: initial.current.style,
      center: initial.current.center,
      zoom: initial.current.zoom,
    });
    appliedStyle.current = initial.current.style;
    mapRef.current = map;

    let timer: number | undefined;
    const report = () => {
      timer = undefined;
      const b = map.getBounds();
      handlers.current.onView({
        bounds: { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
        zoom: map.getZoom(),
      });
    };
    const throttled = () => {
      timer ??= window.setTimeout(report, THROTTLE_MS);
    };
    map.on('move', throttled);
    map.on('load', () => {
      report();
      handlers.current.onReady(map);
    });
    map.on('idle', () => handlers.current.onIdle(map.getZoom()));

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyle.current === style) return;
    appliedStyle.current = style;
    map.setStyle(style, { diff: true });
  }, [style]);

  return <div ref={containerRef} className="map-view" role="region" aria-label="Map preview" />;
}
