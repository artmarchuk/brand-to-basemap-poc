import type { LayerSpecification } from 'maplibre-gl';
import type { LayerSplit, StyleMapping } from '../mapping/types';
import type { WarningHandler } from './fallback';

// A filter cannot mix syntaxes, so the class test follows the one the layer already uses.
function classTest(filter: unknown[], classes: string[], included: boolean): unknown[] {
  const isExpression = JSON.stringify(filter).includes('["get",');
  if (isExpression) return ['match', ['get', 'class'], classes, included, !included];
  return [included ? 'in' : '!in', 'class', ...classes];
}

function splitLayer(layer: LayerSpecification, filter: unknown[], { newId, classes }: LayerSplit): LayerSpecification[] {
  const narrowed = (included: boolean) => ({ ...layer, filter: ['all', filter, classTest(filter, classes, included)] });
  return [narrowed(false), { ...narrowed(true), id: newId }] as unknown as LayerSpecification[];
}

/** The base layers with the mapping's splits applied. A split that cannot run is skipped with a warning. */
export function expandLayers(
  layers: LayerSpecification[],
  mapping: StyleMapping,
  warn: WarningHandler,
): LayerSpecification[] {
  const splits = mapping.splits ?? [];
  for (const { layerId } of splits) {
    if (!layers.some((layer) => layer.id === layerId)) {
      warn({ code: 'missing-split', layerId, message: `${mapping.id}: no layer "${layerId}" to split` });
    }
  }
  return layers.flatMap((layer) => {
    const split = splits.find((candidate) => candidate.layerId === layer.id);
    const { filter } = layer as { filter?: unknown };
    if (!split) return [layer];
    if (Array.isArray(filter)) return splitLayer(layer, filter, split);
    warn({ code: 'missing-split', layerId: layer.id, message: `${mapping.id}: "${layer.id}" has no filter to split` });
    return [layer];
  });
}
