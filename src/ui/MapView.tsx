import { Map as MapLibreMap, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef } from 'react';
import type { MapView as View } from '../app/brandState';
import type { TileSource } from '../style/source';

// MapLibre 6 ships its worker as a separate module, so the bundler has to emit it.
setWorkerUrl(workerUrl);

interface Props {
  style: StyleSpecification;
  center: [number, number];
  zoom: number;
  onReady: (map: MapLibreMap) => void;
  onZoom: (zoom: number) => void;
  /** The map has finished drawing at this zoom. */
  onIdle: (zoom: number) => void;
  /** The map stopped moving: for the share link and autosave. */
  onMove: (view: View) => void;
  /** The provider's logo, where its terms require one on the map. */
  logo?: TileSource['logo'];
}

const THROTTLE_MS = 250;

export function MapView({ style, center, zoom, onReady, onZoom, onIdle, onMove, logo }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const appliedStyle = useRef<StyleSpecification | null>(null);
  // Handlers can change every render; the map is created once, so it reads them through a ref.
  const handlers = useRef({ onReady, onZoom, onIdle, onMove });
  useEffect(() => {
    handlers.current = { onReady, onZoom, onIdle, onMove };
  });
  const initial = useRef({ style, center, zoom });

  useEffect(() => {
    const map = new MapLibreMap({
      container: containerRef.current!,
      style: initial.current.style,
      center: initial.current.center,
      zoom: initial.current.zoom,
      // Attribution always visible, never collapsed to an icon.
      attributionControl: { compact: false },
    });
    appliedStyle.current = initial.current.style;
    mapRef.current = map;
    // For the capture and comparison scripts.
    (window as { b2bMap?: MapLibreMap }).b2bMap = map;

    let timer: number | undefined;
    const report = () => {
      timer = undefined;
      handlers.current.onZoom(map.getZoom());
    };
    const throttled = () => {
      timer ??= window.setTimeout(report, THROTTLE_MS);
    };
    map.on('zoom', throttled);
    map.on('load', () => {
      report();
      handlers.current.onReady(map);
    });
    map.on('idle', () => {
      handlers.current.onIdle(map.getZoom());
      (window as { mapIdle?: boolean }).mapIdle = true;
    });
    map.on('dataloading', () => ((window as { mapIdle?: boolean }).mapIdle = false));
    map.on('moveend', () => {
      const { lng, lat } = map.getCenter();
      handlers.current.onMove({ center: [lng, lat], zoom: map.getZoom() });
    });

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

  return (
    <>
      <div ref={containerRef} className="map-view" role="region" aria-label="Map preview" />
      {logo && (
        <a className="map-logo" href={logo.href} target="_blank" rel="noreferrer">
          <img src={logo.src} alt={logo.alt} />
        </a>
      )}
    </>
  );
}
