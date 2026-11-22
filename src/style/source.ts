import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/** The tile sources the compiled Liberty style can use. Both serve the OpenMapTiles schema (3.16). */
export type TileSourceId = 'openfreemap' | 'maptiler';

/** Stands in for the user's key in exports. `npm run build` checks no real key reaches dist/. */
export const KEY_PLACEHOLDER = 'YOUR_MAPTILER_KEY';

const OSM = '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>';

export interface TileSource {
  id: TileSourceId;
  name: string;
  /** Shown on the map and written into exports. */
  attribution: string;
  /** MapTiler's free plan requires its logo on the map, linking to maptiler.com. */
  logo?: { href: string; src: string; alt: string };
  needsKey: boolean;
  tiles: (key: string) => string;
  glyphs: (key: string) => string;
  /** Liberty's icon names only exist in the OpenFreeMap sprite, so both sources use it. */
  sprite: string;
}

const OFM_SPRITE = 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm';
const withKey = (url: string, key: string) => `${url}?key=${encodeURIComponent(key)}`;

export const TILE_SOURCES: Record<TileSourceId, TileSource> = {
  openfreemap: {
    id: 'openfreemap',
    name: 'OpenFreeMap',
    attribution: `<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ${OSM}`,
    needsKey: false,
    tiles: () => 'https://tiles.openfreemap.org/planet',
    glyphs: () => 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sprite: OFM_SPRITE,
  },
  maptiler: {
    id: 'maptiler',
    name: 'MapTiler',
    // MapTiler has written permission to replace the OpenMapTiles credit with its own (maptiler.com/copyright).
    attribution: `<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> ${OSM}`,
    logo: { href: 'https://www.maptiler.com', src: 'https://api.maptiler.com/resources/logo.svg', alt: 'MapTiler logo' },
    needsKey: true,
    // v3-openmaptiles is MapTiler's OpenMapTiles-schema planet, the schema Liberty is written for.
    tiles: (key) => withKey('https://api.maptiler.com/tiles/v3-openmaptiles/tiles.json', key),
    glyphs: (key) => withKey('https://api.maptiler.com/fonts/{fontstack}/{range}.pbf', key),
    sprite: OFM_SPRITE,
  },
};

/** The vector source every Liberty layer reads. */
const VECTOR_SOURCE = 'openmaptiles';

/**
 * Points the style at one tile source, with its attribution on the source itself so the style is
 * self-contained. Sources no layer reads (Liberty's hidden relief raster) are dropped. Pure.
 */
export function withTileSource(style: StyleSpecification, sourceId: TileSourceId, key = KEY_PLACEHOLDER): StyleSpecification {
  const source = TILE_SOURCES[sourceId];
  const used = new Set(style.layers.map((layer) => (layer as { source?: string }).source).filter(Boolean));
  const sources = Object.fromEntries(
    Object.entries(style.sources)
      .filter(([id]) => used.has(id))
      .map(([id, spec]) => [id, id === VECTOR_SOURCE ? { type: 'vector', url: source.tiles(key), attribution: source.attribution } : spec]),
  ) as StyleSpecification['sources'];
  return {
    ...style,
    sources,
    glyphs: source.glyphs(key),
    sprite: source.sprite,
    metadata: { ...(style.metadata as object | undefined), 'b2b:source': sourceId },
  };
}

/** A stable layer for user data: above land, water, roads, buildings and boundaries, below every label. */
export const DATA_ANCHOR_ID = 'b2b-data-anchor';

/** Index of the first symbol layer after the last non-symbol one: where the labels start. */
export function labelsStart(layers: LayerSpecification[]): number {
  let lastShape = -1;
  layers.forEach((layer, index) => {
    if (layer.type !== 'symbol') lastShape = index;
  });
  return lastShape + 1;
}

/**
 * Inserts the anchor: an invisible background layer, so it draws nothing and only marks a position.
 * Add data with `map.addLayer(layer, 'b2b-data-anchor')` to put it under the labels.
 */
export function addDataAnchor(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.filter((layer) => layer.id !== DATA_ANCHOR_ID);
  const anchor: LayerSpecification = {
    id: DATA_ANCHOR_ID,
    type: 'background',
    layout: { visibility: 'none' },
    metadata: { 'b2b:role': 'data-anchor', 'b2b:note': "Add your layers with beforeId: 'b2b-data-anchor' to draw them under the labels." },
  };
  const at = labelsStart(layers);
  return { ...style, layers: [...layers.slice(0, at), anchor, ...layers.slice(at)] };
}
