import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef } from 'react';

// MapLibre 6 ships its worker as a separate module, so the bundler has to emit it.
setWorkerUrl(workerUrl);

const ZURICH: [number, number] = [8.5417, 47.3769];

export function MapPreview() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = new MapLibreMap({
      container: containerRef.current!,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: ZURICH,
      zoom: 12,
    });
    return () => map.remove();
  }, []);

  return <div ref={containerRef} className="map-preview" role="region" aria-label="Map of Zurich" />;
}
