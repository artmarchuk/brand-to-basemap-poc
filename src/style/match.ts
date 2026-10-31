import type { LayerSpecification } from 'maplibre-gl';
import type { LayerMatch, MappingRule, StyleMapping } from '../mapping/types';

const asList = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

/** Class values a filter positively selects, in expression or legacy syntax. Negations are ignored. */
export function filterClasses(filter: unknown): string[] {
  if (!Array.isArray(filter)) return [];
  const [operator, first, second] = filter;
  const isClass = first === 'class' || (Array.isArray(first) && first[0] === 'get' && first[1] === 'class');
  if (isClass && operator === '==') return [second];
  if (isClass && operator === 'in') return filter.slice(2);
  if (isClass && operator === 'match' && filter[3] === true) return asList(second);
  if (operator === 'all' || operator === 'any') return filter.slice(1).flatMap(filterClasses);
  return [];
}

function matches(match: LayerMatch, layer: LayerSpecification): boolean {
  const sourceLayer = (layer as { 'source-layer'?: string })['source-layer'];
  if (match.ids && !match.ids.includes(layer.id)) return false;
  if (match.type && !asList(match.type).includes(layer.type)) return false;
  if (match.sourceLayer && !asList(match.sourceLayer).includes(sourceLayer ?? '')) return false;
  if (match.idPattern && !match.idPattern.test(layer.id)) return false;
  if (match.classes) {
    const classes = filterClasses((layer as { filter?: unknown }).filter);
    if (!classes.some((name) => match.classes!.includes(name))) return false;
  }
  return true;
}

export function findRule(mapping: StyleMapping, layer: LayerSpecification): MappingRule | undefined {
  return mapping.rules.find((candidate) => matches(candidate.match, layer));
}

export function colorProperties(layer: LayerSpecification): string[] {
  return Object.keys(layer.paint ?? {}).filter((property) => property.endsWith('-color'));
}
