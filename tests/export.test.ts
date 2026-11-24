import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { initialState, reducer, type Action } from '../src/app/appState';
import { compileBrand } from '../src/app/compile';
import { BRAND_STATE_VERSION } from '../src/app/brandState';
import { exportSnippet, exportStyle } from '../src/export/export';
import { exportTokensCss, exportTokensDtcg } from '../src/export/tokens';
import { getPreset } from '../src/presets';
import { DATA_ANCHOR_ID, KEY_PLACEHOLDER, TILE_SOURCES, withTileSource } from '../src/style/source';
import { rgbKey } from '../src/tokens/color';
import { cssVariableName } from '../src/tokens/css';
import { SCHEMA_VERSION, TOKEN_NAMES, type TokenName } from '../src/tokens/types';

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

describe('token export', () => {
  const states = ['single-ink', 'figure-ground', 'colour-field'].flatMap((presetId) => [
    brandAfter({ type: 'preset', presetId }),
    brandAfter({ type: 'preset', presetId }, { type: 'slot', slot: getPreset(presetId).slots[0].id, hex: '#f5b700' }),
    brandAfter({ type: 'preset', presetId }, { type: 'override', token: 'park', hex: '#123456' }),
    brandAfter({ type: 'preset', presetId }, { type: 'mode', mode: 'data' }, { type: 'recede', recede: 80 }),
    brandAfter({ type: 'preset', presetId }, { type: 'mode', mode: 'data' }, { type: 'recede', recede: 80 }, { type: 'override', token: 'water', hex: '#abcdef' }),
  ]);

  /** Every colour string anywhere in the compiled layers, as canonical hex. */
  const renderedColours = (layers: LayerSpecification[]) => {
    const found = new Set<string>();
    const walk = (value: unknown) => {
      if (typeof value === 'string') {
        const key = rgbKey(value);
        if (key) found.add(key);
      } else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    layers.forEach((layer) => walk(layer.paint));
    return found;
  };

  it('DTCG and CSS contain every resolved token, in every preset, with slots, overrides, data mode and recede', () => {
    for (const state of states) {
      const { resolved } = compileBrand(state);
      const dtcg = exportTokensDtcg(resolved.tokens, state, { source: 'openfreemap' });
      const css = exportTokensCss(resolved.tokens, state, { source: 'openfreemap' });
      expect(Object.keys(dtcg.map)).toEqual([...TOKEN_NAMES]);
      for (const token of TOKEN_NAMES) {
        expect(dtcg.map[token]).toMatchObject({ $type: 'color', $value: resolved.tokens[token] });
        expect(dtcg.map[token].$value).toMatch(/^#[0-9a-f]{6}$/);
        expect(css).toContain(`  ${cssVariableName(token)}: ${resolved.tokens[token]};`);
      }
      expect(css).toMatch(/^\/\*.*\*\/\n:root \{\n/);
      expect(css.match(/--b2b-[a-z-]+: #[0-9a-f]{6};/g)).toHaveLength(TOKEN_NAMES.length);
    }
  });

  it('matches the colours the map renders', () => {
    for (const state of states) {
      const { resolved, style: compiled } = compileBrand(state);
      const dtcg = exportTokensDtcg(resolved.tokens, state, { source: 'openfreemap' });
      const layers = withTileSource(compiled, 'openfreemap').layers;
      const background = layers.find((layer) => layer.type === 'background' && layer.id !== DATA_ANCHOR_ID)!;
      expect(rgbKey((background.paint as { 'background-color': string })['background-color'])).toBe(dtcg.map.land.$value);
      // Tokens the compiler writes straight into a paint property. (Others are mixed or drawn translucent.)
      const rendered = renderedColours(layers);
      for (const token of ['land', 'water', 'roadMajor', 'roadHighway', 'building', 'labelPrimary', 'halo'] as const) {
        expect(rendered, `${state.presetId} ${state.mode} ${token}`).toContain(dtcg.map[token].$value);
      }
      // An override reaches both.
      const overrides = state.perPreset[state.presetId]?.overrides[state.mode] ?? {};
      for (const [token, hex] of Object.entries(overrides)) expect(dtcg.map[token as TokenName].$value).toBe(hex);
    }
  });

  it('records the preset, primary, tile source and state version in $extensions', () => {
    const data = brandAfter({ type: 'mode', mode: 'data' }, { type: 'recede', recede: 40 });
    const dtcg = exportTokensDtcg(compileBrand(data).resolved.tokens, data, { source: 'maptiler' });
    expect(dtcg.$extensions.b2b).toEqual({
      preset: data.presetId,
      primary: data.primary,
      mode: 'data',
      recede: 40,
      tileSource: 'maptiler',
      stateVersion: BRAND_STATE_VERSION,
      tokenSchema: SCHEMA_VERSION,
    });
    expect(exportTokensDtcg(compileBrand(brand).resolved.tokens, brand, { source: 'openfreemap' }).$extensions.b2b).not.toHaveProperty('recede');
  });

  it('never contains a key, on either source', () => {
    for (const source of ['openfreemap', 'maptiler'] as const) {
      // Even a state object that carries a stray key cannot leak it: only named fields are read.
      const dirty = { ...brand, key: KEY, apiKey: KEY } as typeof brand;
      const tokens = compileBrand(brand).resolved.tokens;
      const text = JSON.stringify(exportTokensDtcg(tokens, dirty, { source })) + exportTokensCss(tokens, dirty, { source });
      expect(text).not.toContain(KEY);
      expect(text).not.toMatch(/key=|api\.maptiler|YOUR_MAPTILER_KEY/i);
    }
  });
});
