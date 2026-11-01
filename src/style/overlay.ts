import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Overlay } from '../app/overlay';
import type { ResolvedTokens } from '../tokens/types';
import { formatColor, mixColors, parseColor } from '../tokens/color';

export const OVERLAY_SOURCES = { hexes: 'demo-hexes', points: 'demo-points' } as const;

/** Colours come from the tokens: a ramp from land to accent for the hexagons, accent points with a halo. */
export function overlayLayers(tokens: ResolvedTokens): LayerSpecification[] {
  const land = parseColor(tokens.land)!;
  const accent = parseColor(tokens.accent)!;
  const ramp = [0, 0.25, 0.5, 0.75, 1].flatMap((value) => [value, formatColor(mixColors(land, accent, 0.15 + value * 0.75))]);
  return [
    {
      id: 'demo-hexes',
      type: 'fill',
      source: OVERLAY_SOURCES.hexes,
      paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'value'], ...ramp], 'fill-opacity': 0.72 },
    },
    {
      id: 'demo-points',
      type: 'circle',
      source: OVERLAY_SOURCES.points,
      paint: {
        'circle-color': tokens.accent,
        'circle-radius': ['interpolate', ['linear'], ['get', 'weight'], 0, 3, 1, 8],
        'circle-stroke-color': tokens.halo,
        'circle-stroke-width': 1.5,
      },
    },
  ] as LayerSpecification[];
}

/**
 * The hexagons go under the first line layer, so roads draw over the data; the points go under the first
 * label, so labels render above everything. The overlay is demo-only: exports are built without it.
 */
export function withOverlay(style: StyleSpecification, overlay: Overlay, tokens: ResolvedTokens): StyleSpecification {
  const indexOf = (type: string, from = 0) => {
    const found = style.layers.findIndex((layer, index) => index >= from && layer.type === type);
    return found === -1 ? style.layers.length : found;
  };
  const pointsAt = indexOf('symbol');
  const hexesAt = Math.min(indexOf('line'), pointsAt);
  const [hexes, points] = overlayLayers(tokens);
  return {
    ...style,
    sources: {
      ...style.sources,
      [OVERLAY_SOURCES.hexes]: { type: 'geojson', data: overlay.hexes },
      [OVERLAY_SOURCES.points]: { type: 'geojson', data: overlay.points },
    },
    layers: [...style.layers.slice(0, hexesAt), hexes, ...style.layers.slice(hexesAt, pointsAt), points, ...style.layers.slice(pointsAt)],
  };
}
