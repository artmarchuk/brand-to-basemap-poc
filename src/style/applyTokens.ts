import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { ColorRef, ColorSpec, LabelDensity, MappingRule, StyleMapping, ToggleGroup } from '../mapping/types';
import type { ResolvedTokens } from '../tokens/types';
import { fallbackRef, fallbackRule, warnToConsole, type WarningHandler } from './fallback';
import { colorProperties, findRule } from './match';
import { rewriteColors } from './rewrite';
import { expandLayers } from './split';

/** F2 default: land, water, parks, major roads (all `core`) and place labels. */
export const DEFAULT_GROUPS: ToggleGroup[] = ['core', 'labels'];
export const DEFAULT_LABEL_DENSITY: LabelDensity = 'low';

/**
 * Streets are part of the base map once they stop being clutter. With `minorRoads` off they still draw from
 * this zoom; the toggle only decides whether they also show below it.
 */
export const MINOR_ROADS_BASE_ZOOM = 14;

const DENSITY_ORDER: LabelDensity[] = ['low', 'medium', 'high'];

export interface ApplyOptions {
  mapping: StyleMapping;
  groups?: ToggleGroup[];
  labelDensity?: LabelDensity;
  /** Called for each layer or colour the mapping does not cover. Defaults to console.warn. */
  onWarning?: WarningHandler;
}

function isVisible(rule: MappingRule, groups: ToggleGroup[], density: LabelDensity): boolean {
  if (rule.group === 'core') return true;
  if (!groups.includes(rule.group!)) return false;
  return !rule.density || DENSITY_ORDER.indexOf(rule.density) <= DENSITY_ORDER.indexOf(density);
}

const firstRef = (spec: ColorSpec): ColorRef => (typeof spec === 'object' && 'stops' in spec ? spec.stops[0] : spec);

function rewriteSafely(
  layer: LayerSpecification,
  property: string,
  value: unknown,
  spec: ColorSpec,
  tokens: ResolvedTokens,
  warn: WarningHandler,
): unknown {
  try {
    return rewriteColors(value, spec, tokens);
  } catch (error) {
    const message = `Layer "${layer.id}" ${property}: ${(error as Error).message}`;
    warn({ code: 'unsupported-color', layerId: layer.id, message });
    return rewriteColors('#000', firstRef(spec), tokens);
  }
}

function restyleLayer(
  layer: LayerSpecification,
  rule: MappingRule,
  tokens: ResolvedTokens,
  visible: boolean,
  warn: WarningHandler,
): LayerSpecification {
  const paint: Record<string, unknown> = { ...layer.paint };

  for (const property of colorProperties(layer)) {
    let spec = rule.colors?.[property];
    if (!spec) {
      warn({ code: 'unmapped-color', layerId: layer.id, message: `Layer "${layer.id}": no colour rule for ${property}` });
      spec = fallbackRef(property);
    }
    paint[property] = rewriteSafely(layer, property, paint[property], spec, tokens, warn);
  }

  if (rule.replacePattern) {
    const kind = layer.type === 'line' ? 'line' : 'fill';
    delete paint[`${kind}-pattern`];
    paint[`${kind}-color`] = rewriteColors('#000', rule.colors![`${kind}-color`], tokens);
  }

  const output = {
    ...layer,
    ...(rule.flatten && { type: 'fill' }),
    paint: rule.flatten ? flatPaint(paint, rule, tokens) : paint,
    layout: { ...layer.layout, visibility: visible ? 'visible' : 'none' },
    metadata: {
      ...(layer.metadata as object | undefined),
      'b2b:group': rule.group,
      ...(rule.density && { 'b2b:density': rule.density }),
    },
  } as LayerSpecification;

  const filter = (layer as { filter?: unknown[] }).filter;
  if (rule.filterGuard && filter) {
    (output as { filter?: unknown }).filter = ['all', rule.filterGuard, ...filter.slice(1)];
  }
  return output;
}

/** An opaque fill in exactly the token's colour, with no 3D lighting to shift it. */
function flatPaint(paint: Record<string, unknown>, rule: MappingRule, tokens: ResolvedTokens) {
  return {
    'fill-color': paint['fill-extrusion-color'] ?? paint['fill-color'],
    'fill-outline-color': paint['fill-outline-color'] ?? rewriteColors('#000', rule.colors!['fill-outline-color'], tokens),
  };
}

/** Pure: the base style is not mutated and the same inputs give the same style. */
export function applyTokens(
  baseStyle: StyleSpecification,
  tokens: ResolvedTokens,
  { mapping, groups = DEFAULT_GROUPS, labelDensity = DEFAULT_LABEL_DENSITY, onWarning = warnToConsole }: ApplyOptions,
): StyleSpecification {
  const layers = expandLayers(baseStyle.layers, mapping, onWarning).flatMap((layer) => {
    let rule = findRule(mapping, layer);
    const known = Boolean(rule);
    if (!rule) {
      onWarning({ code: 'unmapped-layer', layerId: layer.id, message: `${mapping.id}: no rule for ${layer.type} layer "${layer.id}"` });
      rule = fallbackRule(layer);
    }
    if (rule.hidden) return [];
    // A layer new to the mapping stays off: only known minor roads join the base map.
    const fromBaseZoom = known && rule.group === 'minorRoads' && !groups.includes('minorRoads');
    const styled = restyleLayer(layer, rule, tokens, fromBaseZoom || isVisible(rule, groups, labelDensity), onWarning);
    return [fromBaseZoom ? { ...styled, minzoom: Math.max(styled.minzoom ?? 0, MINOR_ROADS_BASE_ZOOM) } : styled];
  });
  return { ...baseStyle, layers };
}
