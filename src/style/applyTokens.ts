import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { LabelDensity, MappingRule, StyleMapping, ToggleGroup } from '../mapping/types';
import type { ResolvedTokens } from '../tokens/types';
import { colorProperties, findRule } from './match';
import { rewriteColors } from './rewrite';

/** F2 default: land, water, parks, major roads (all `core`) and place labels. */
export const DEFAULT_GROUPS: ToggleGroup[] = ['core', 'labels'];
export const DEFAULT_LABEL_DENSITY: LabelDensity = 'low';

const DENSITY_ORDER: LabelDensity[] = ['low', 'medium', 'high'];

export interface ApplyOptions {
  mapping: StyleMapping;
  groups?: ToggleGroup[];
  labelDensity?: LabelDensity;
}

function isVisible(rule: MappingRule, groups: ToggleGroup[], density: LabelDensity): boolean {
  if (rule.group === 'core') return true;
  if (!groups.includes(rule.group!)) return false;
  return !rule.density || DENSITY_ORDER.indexOf(rule.density) <= DENSITY_ORDER.indexOf(density);
}

function restyleLayer(
  layer: LayerSpecification,
  rule: MappingRule,
  tokens: ResolvedTokens,
  visible: boolean,
): LayerSpecification {
  const paint: Record<string, unknown> = { ...layer.paint };

  for (const property of colorProperties(layer)) {
    const spec = rule.colors?.[property];
    if (!spec) throw new Error(`Layer "${layer.id}": no colour rule for ${property}`);
    paint[property] = rewriteColors(paint[property], spec, tokens);
  }

  if (rule.replacePattern) {
    delete paint['fill-pattern'];
    paint['fill-color'] = rewriteColors('#000', rule.colors!['fill-color'], tokens);
  }

  const output = {
    ...layer,
    paint,
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

/** Pure: the base style is not mutated and the same inputs give the same style. */
export function applyTokens(
  baseStyle: StyleSpecification,
  tokens: ResolvedTokens,
  { mapping, groups = DEFAULT_GROUPS, labelDensity = DEFAULT_LABEL_DENSITY }: ApplyOptions,
): StyleSpecification {
  const layers = baseStyle.layers.flatMap((layer) => {
    const rule = findRule(mapping, layer);
    if (rule.hidden) return [];
    return [restyleLayer(layer, rule, tokens, isVisible(rule, groups, labelDensity))];
  });
  return { ...baseStyle, layers };
}
