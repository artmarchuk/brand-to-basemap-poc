import type { LayerSpecification } from 'maplibre-gl';
import type { ColorRef, MappingRule, ToggleGroup } from '../mapping/types';
import { tint } from '../mapping/shared';
import { colorProperties } from './match';

/** Why a style needed a fallback. M4 turns these into a UI notice. */
export interface StyleWarning {
  code: 'unmapped-layer' | 'unmapped-color' | 'unsupported-color' | 'missing-split';
  layerId: string;
  message: string;
}

export type WarningHandler = (warning: StyleWarning) => void;

export const warnToConsole: WarningHandler = ({ code, message }) => console.warn(`[b2b] ${code}: ${message}`);

// New layers default to quiet: off by default and neutral, so provider drift cannot shout.
const GROUP_BY_TYPE: Record<string, ToggleGroup> = {
  background: 'core',
  fill: 'landuse',
  'fill-extrusion': 'buildings',
  line: 'minorRoads',
  symbol: 'labels',
  circle: 'pois',
};

const IMAGERY = ['raster', 'hillshade', 'heatmap', 'color-relief'];

export function fallbackRef(property: string): ColorRef {
  if (property.includes('halo') || property.includes('stroke')) return 'halo';
  if (property === 'background-color') return 'land';
  if (property === 'text-color' || property === 'icon-color') return 'labelSecondary';
  if (property === 'fill-extrusion-color') return 'building';
  if (property === 'circle-color') return 'accent';
  if (property === 'fill-color') return tint('land', 'labelSecondary', 0.08);
  return tint('land', 'labelSecondary', 0.3);
}

/** The rule for a layer no mapping rule matches, chosen from its type alone. */
export function fallbackRule(layer: LayerSpecification): MappingRule {
  const why = `No mapping rule: type-based ${layer.type} fallback.`;
  if (IMAGERY.includes(layer.type)) return { match: {}, hidden: true, fallback: true, why };

  const paint = (layer.paint ?? {}) as Record<string, unknown>;
  const properties = new Set(colorProperties(layer));
  const replacePattern = 'fill-pattern' in paint || 'line-pattern' in paint;
  if (replacePattern) properties.add(`${layer.type}-color`);
  if (layer.type === 'fill-extrusion') properties.add('fill-outline-color');

  return {
    match: {},
    fallback: true,
    why,
    group: GROUP_BY_TYPE[layer.type] ?? 'pois',
    ...(layer.type === 'symbol' && { density: 'high' as const }),
    ...(layer.type === 'fill-extrusion' && { flatten: true }),
    ...(replacePattern && { replacePattern }),
    colors: Object.fromEntries([...properties].map((property) => [property, fallbackRef(property)])),
  };
}
