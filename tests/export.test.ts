import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { initialState, reducer, type Action } from '../src/app/appState';
import { compileBrand } from '../src/app/compile';
import { exportSnippet, exportStyle } from '../src/export/export';
import { DATA_ANCHOR_ID, KEY_PLACEHOLDER, TILE_SOURCES, withTileSource } from '../src/style/source';

const brandAfter = (...actions: Action[]) => actions.reduce(reducer, initialState()).brand;
const brand = brandAfter({ type: 'preset', presetId: 'colour-field' });
const { style } = compileBrand(brand);
const KEY = 'TestKeyAbcdefghij1234';
const view = { center: brand.view.center, zoom: brand.view.zoom };

const isLabel = (layer: LayerSpecification) => layer.type === 'symbol';
const isShape = (layer: LayerSpecification) => ['fill', 'line', 'fill-extrusion'].includes(layer.type);

/** What map.addLayer(layer, beforeId) does to the layer order. */
const addBefore = (layers: LayerSpecification[], layer: LayerSpecification, beforeId: string) => {
  const at = layers.findIndex((candidate) => candidate.id === beforeId);
  return [...layers.slice(0, at), layer, ...layers.slice(at)];
};

describe('data anchor', () => {
  it('sits above every fill and line and below every label, in every preset and data mode', () => {
    for (const presetId of ['single-ink', 'figure-ground', 'colour-field']) {
      for (const mode of ['light', 'data'] as const) {
        const { layers } = compileBrand(brandAfter({ type: 'preset', presetId }, { type: 'mode', mode })).style;
        const anchor = layers.findIndex((layer) => layer.id === DATA_ANCHOR_ID);
        expect(anchor).toBeGreaterThan(0);
        expect(layers.slice(anchor + 1).some(isShape)).toBe(false);
        expect(layers.slice(0, anchor).filter((layer) => layer.layout?.visibility !== 'none').some(isLabel)).toBe(false);
        expect(layers[anchor]).toMatchObject({ type: 'background', layout: { visibility: 'none' } });
      }
    }
  });

  it('a GeoJSON layer added with beforeId draws over land, water and roads and under the labels', () => {
    const data: LayerSpecification = { id: 'my-data', type: 'fill', source: 'mine', paint: { 'fill-color': '#ff0000' } };
    const layers = addBefore(style.layers, data, DATA_ANCHOR_ID);
    const at = layers.indexOf(data);
    const before = layers.slice(0, at).map((layer) => layer.id);
    for (const id of ['water', 'park', 'road_motorway', 'road_minor', 'building']) expect(before).toContain(id);
    for (const id of ['label_city', 'water_name_point_label', 'highway-name-major']) expect(before).not.toContain(id);
  });
});

describe('style export', () => {
  it('is a valid MapLibre style, self-contained, with attribution, on both sources', () => {
    for (const source of ['openfreemap', 'maptiler'] as const) {
      const exported = exportStyle(style, brand, { source });
      expect(validateStyleMin(exported as never)).toEqual([]);
      expect((exported.sources.openmaptiles as { attribution: string }).attribution).toBe(TILE_SOURCES[source].attribution);
      expect(Object.keys(exported.sources)).toEqual(['openmaptiles']);
      expect(exported.layers.some((layer) => layer.id === DATA_ANCHOR_ID)).toBe(true);
    }
  });

  it('OpenFreeMap involves no key', () => {
    expect(JSON.stringify(exportStyle(style, brand, { source: 'openfreemap' }))).not.toMatch(/key=|MAPTILER/i);
  });

  it('MapTiler uses the placeholder unless the key is opted in', () => {
    const placeholder = JSON.stringify(exportStyle(style, brand, { source: 'maptiler' }));
    expect(placeholder).toContain(`key=${KEY_PLACEHOLDER}`);
    expect(placeholder).toContain('api.maptiler.com/tiles/v3-openmaptiles/tiles.json');
    expect(placeholder).toContain('api.maptiler.com/fonts/{fontstack}/{range}.pbf');
    const withKey = JSON.stringify(exportStyle(style, brand, { source: 'maptiler', key: KEY }));
    expect(withKey).toContain(`key=${KEY}`);
    expect(withKey).not.toContain(`key=${KEY_PLACEHOLDER}`);
  });

  it('reflects the state: preset colours and data mode', () => {
    const data = brandAfter({ type: 'mode', mode: 'data' }, { type: 'recede', recede: 90 });
    const light = exportStyle(compileBrand(brandAfter()).style, brandAfter(), { source: 'openfreemap' });
    const receded = exportStyle(compileBrand(data).style, data, { source: 'openfreemap' });
    expect(JSON.stringify(receded.layers)).not.toEqual(JSON.stringify(light.layers));
    expect(receded.metadata).toMatchObject({ 'b2b:export': { mode: 'data', recede: 90 } });
  });

  it('the app and the export compile the same layers', () => {
    expect(exportStyle(style, brand, { source: 'maptiler', key: KEY }).layers).toEqual(withTileSource(style, 'maptiler', KEY).layers);
  });
});

describe('embed snippet', () => {
  it('OpenFreeMap: CDN MapLibre, expanded attribution, no key, no logo, the anchor comment', () => {
    const html = exportSnippet(style, brand, { source: 'openfreemap', ...view });
    expect(html).toContain('https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');
    expect(html).toContain('attributionControl: { compact: false }');
    expect(html).toContain("beforeId 'b2b-data-anchor'");
    expect(html).not.toMatch(/MAPTILER_KEY|maptiler/i);
  });

  it('MapTiler: the placeholder once, the logo, and the key only with the opt-in', () => {
    const html = exportSnippet(style, brand, { source: 'maptiler', ...view });
    expect(html).toContain(`const MAPTILER_KEY = "${KEY_PLACEHOLDER}"`);
    expect(html).toContain('https://api.maptiler.com/resources/logo.svg');
    expect(html).not.toContain(KEY);
    const withKey = exportSnippet(style, brand, { source: 'maptiler', key: KEY, ...view });
    expect(withKey.split(KEY).length - 1).toBe(1);
    expect(withKey).toContain('do not share it publicly');
  });

  it('cannot break out of its script element', () => {
    const html = exportSnippet(style, { ...brand, presetId: '</script><b>' as string }, { source: 'openfreemap', ...view });
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});
