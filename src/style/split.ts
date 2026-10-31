import type { LayerSpecification } from 'maplibre-gl';
import type { LayerSplit, StyleMapping } from '../mapping/types';

function splitLayer(layer: LayerSpecification, split: LayerSplit): LayerSpecification[] {
  const { filter } = layer as { filter?: unknown };
  if (!Array.isArray(filter)) throw new Error(`Split "${split.layerId}" needs a filtered layer`);
  const withClass = (test: unknown[]) => ({ filter: ['all', filter, test] });
  return [
    { ...layer, ...withClass(['!in', 'class', ...split.classes]) } as LayerSpecification,
    { ...layer, id: split.newId, ...withClass(['in', 'class', ...split.classes]) } as LayerSpecification,
  ];
}

/** The base layers with the mapping's splits applied. Every split must find its layer. */
export function expandLayers(layers: LayerSpecification[], mapping: StyleMapping): LayerSpecification[] {
  const splits = mapping.splits ?? [];
  for (const { layerId } of splits) {
    if (!layers.some((layer) => layer.id === layerId)) throw new Error(`${mapping.id}: no layer "${layerId}" to split`);
  }
  return layers.flatMap((layer) => {
    const split = splits.find((candidate) => candidate.layerId === layer.id);
    return split ? splitLayer(layer, split) : [layer];
  });
}
