import type { LayerSpecification } from 'maplibre-gl';
import type { ColorRef, LayerRole, StyleMapping } from '../mapping/types';
import type { ResolvedTokens } from '../tokens/types';
import { rewriteColors } from './rewrite';

/** Zoom-to-pixel stops, drawn as an exponential 1.2 ramp like Liberty's own road widths. */
export type WidthStops = [zoom: number, width: number][];

export interface RoadTreatment {
  /** Replaces the base style's width on every layer of this road class. Absent keeps the base width. */
  width?: WidthStops;
  /** `base` keeps the base casing, `none` hides it, `hairline` makes it the road's width plus this many pixels. */
  casing: 'base' | 'none' | { hairline: number };
}

/**
 * Everything a preset changes besides colour tokens. Colours here are still token refs, so the map reads no
 * colour that is not a token. Resolved: the compiler gets concrete numbers, not weight names.
 */
export interface Treatment {
  roadMajor: RoadTreatment;
  roadMinor: RoadTreatment;
  boundaryDash?: number[];
  waterLabel?: { text: ColorRef; halo: ColorRef };
  /** Halo around POI text, the accent's outline. */
  accentOutline?: ColorRef;
  /** Built-up land fades out between these zooms, as buildings take over. */
  urbanLanduseFade?: [from: number, to: number];
  /** Layers with these roles are not drawn. */
  hide?: LayerRole[];
  /** Halo width in pixels for place labels, drawn without blur. Wide enough to be the label's ground. */
  labelHaloWidth?: number;
}

const ramp = (stops: WidthStops) => ['interpolate', ['exponential', 1.2], ['zoom'], ...stops.flat()];

/** Adds `px` to each output of a zoom ramp, so a casing hugs its road. Any other width is returned unchanged. */
export function widen(width: unknown, px: number): unknown {
  if (typeof width === 'number') return width + px;
  if (!Array.isArray(width) || width[0] !== 'interpolate' || !Array.isArray(width[2]) || width[2][0] !== 'zoom') return width;
  return width.map((value, i) => (i >= 4 && i % 2 === 1 && typeof value === 'number' ? value + px : value));
}

type Mutable = LayerSpecification & { paint: Record<string, unknown>; layout: Record<string, unknown>; metadata: Record<string, unknown> };
const roleOf = (layer: LayerSpecification) => (layer.metadata as Record<string, unknown> | undefined)?.['b2b:role'] as LayerRole | undefined;

/** Pure: returns new layers with the treatment applied by role. Layers without a role pass through. */
export function applyTreatment(
  layers: LayerSpecification[],
  treatment: Treatment,
  tokens: ResolvedTokens,
  mapping: StyleMapping,
): LayerSpecification[] {
  const out = layers.map((layer) => {
    const role = roleOf(layer);
    if (!role) return layer;
    const next = { ...layer, paint: { ...layer.paint }, layout: { ...layer.layout } } as Mutable;
    const road = role === 'roadMajor' ? treatment.roadMajor : role === 'roadMinor' ? treatment.roadMinor : undefined;
    if (road?.width) next.paint['line-width'] = ramp(road.width);

    const casing = role === 'roadMajorCasing' ? treatment.roadMajor.casing : role === 'roadMinorCasing' ? treatment.roadMinor.casing : undefined;
    if (casing === 'none' || treatment.hide?.includes(role)) next.layout.visibility = 'none';

    if (role === 'boundary' && treatment.boundaryDash) next.paint['line-dasharray'] = treatment.boundaryDash;
    if (role === 'waterLabel' && treatment.waterLabel) {
      next.paint['text-color'] = rewriteColors(layer.paint?.['text-color' as keyof typeof layer.paint] ?? '#000', treatment.waterLabel.text, tokens);
      next.paint['text-halo-color'] = rewriteColors('#000', treatment.waterLabel.halo, tokens);
    }
    if (role === 'placeLabel' && treatment.labelHaloWidth !== undefined) {
      next.paint['text-halo-width'] = treatment.labelHaloWidth;
      next.paint['text-halo-blur'] = 0;
    }
    if (role === 'poi' && treatment.accentOutline) next.paint['text-halo-color'] = rewriteColors('#000', treatment.accentOutline, tokens);
    if (role === 'urbanLanduse' && treatment.urbanLanduseFade) {
      const [from, to] = treatment.urbanLanduseFade;
      next.paint['fill-opacity'] = ['interpolate', ['linear'], ['zoom'], from, 1, to, 0];
    }
    return next;
  });

  // Hairline casings follow their road's final width, so this runs after the roads are done.
  const suffix = mapping.casingSuffix;
  if (!suffix) return out;
  const byId = new Map(out.map((layer) => [layer.id, layer]));
  return out.map((layer) => {
    const role = roleOf(layer);
    const casing = role === 'roadMajorCasing' ? treatment.roadMajor.casing : role === 'roadMinorCasing' ? treatment.roadMinor.casing : undefined;
    if (!casing || typeof casing !== 'object' || !layer.id.endsWith(suffix)) return layer;
    const road = byId.get(layer.id.slice(0, -suffix.length));
    const width = (road?.paint as Record<string, unknown> | undefined)?.['line-width'];
    if (width === undefined) return layer;
    return { ...layer, paint: { ...layer.paint, 'line-width': widen(width, casing.hairline) } } as LayerSpecification;
  });
}
