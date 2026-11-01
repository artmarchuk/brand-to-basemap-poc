// The data-mode demo overlay: fictional points and a hex-grid choropleth, generated on the fly for
// whatever is on screen. Values are seeded from grid position, so the same place always looks the same
// and nothing is stored, fetched or exported.
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Overlay {
  hexes: FeatureCollection<Polygon, { value: number }>;
  points: FeatureCollection<Point, { weight: number }>;
}

const SEED = 20261031;
/** Hexagons across the width of the view, before snapping to a power of two. */
const HEXES_ACROSS = 14;

/** Deterministic hash of two integers into [0, 1). */
export function hash2(x: number, y: number, seed = SEED): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise: neighbouring positions get similar values, so the choropleth has regions, not static. */
function noise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const top = hash2(x0, y0) * (1 - fx) + hash2(x0 + 1, y0) * fx;
  const bottom = hash2(x0, y0 + 1) * (1 - fx) + hash2(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

export function buildOverlay(bounds: Bounds): Overlay {
  const centreLat = (bounds.north + bounds.south) / 2;
  const squeeze = Math.max(0.2, Math.cos((centreLat * Math.PI) / 180));
  const width = bounds.east - bounds.west;
  // Snap the size to a power of two, so small pans and zooms keep the same cells.
  const lngSize = 2 ** Math.round(Math.log2(width / HEXES_ACROSS / Math.sqrt(3)));
  const latSize = lngSize * squeeze;

  const hexes: Feature<Polygon, { value: number }>[] = [];
  const rMin = Math.floor(bounds.south / (latSize * 1.5)) - 1;
  const rMax = Math.ceil(bounds.north / (latSize * 1.5)) + 1;
  for (let r = rMin; r <= rMax; r++) {
    const qMin = Math.floor(bounds.west / (lngSize * Math.sqrt(3)) - r / 2) - 1;
    const qMax = Math.ceil(bounds.east / (lngSize * Math.sqrt(3)) - r / 2) + 1;
    for (let q = qMin; q <= qMax; q++) {
      const lng = lngSize * Math.sqrt(3) * (q + r / 2);
      const lat = latSize * 1.5 * r;
      const ring = Array.from({ length: 7 }, (_, corner) => {
        const angle = ((30 + 60 * (corner % 6)) * Math.PI) / 180;
        return [lng + lngSize * Math.cos(angle), lat + latSize * Math.sin(angle)];
      });
      const value = 0.75 * noise(q / 5, r / 5) + 0.25 * hash2(q, r, SEED + 1);
      hexes.push({ type: 'Feature', properties: { value }, geometry: { type: 'Polygon', coordinates: [ring] } });
    }
  }

  const points: Feature<Point, { weight: number }>[] = [];
  const step = lngSize * 2.4;
  const stepLat = step * squeeze;
  for (let j = Math.floor(bounds.south / stepLat) - 1; j <= Math.ceil(bounds.north / stepLat); j++) {
    for (let i = Math.floor(bounds.west / step) - 1; i <= Math.ceil(bounds.east / step); i++) {
      if (hash2(i, j, SEED + 2) < 0.45) continue;
      const coordinates = [(i + hash2(i, j, SEED + 3)) * step, (j + hash2(i, j, SEED + 4)) * stepLat];
      points.push({ type: 'Feature', properties: { weight: hash2(i, j, SEED + 5) }, geometry: { type: 'Point', coordinates } });
    }
  }

  return {
    hexes: { type: 'FeatureCollection', features: hexes },
    points: { type: 'FeatureCollection', features: points },
  };
}
