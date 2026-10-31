import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import dark from '../harness/tokens/dark.json';
import { MAPPINGS } from '../src/mapping';
import { rgbKey } from '../src/tokens/color';
import { TOKEN_NAMES, type ResolvedTokens } from '../src/tokens/types';
import { applyTokens, DEFAULT_GROUPS } from '../src/style/applyTokens';
import { detectDrift, hasDrift } from '../src/style/drift';
import { collectColors } from '../src/style/expressions';
import type { StyleWarning } from '../src/style/fallback';
import { colorProperties } from '../src/style/match';
import { buildReport } from '../src/style/report';

// Streets v2 is gitignored, so its cases run only where `npm run fetch-styles` has been run.
const CASES = Object.keys(MAPPINGS)
  .filter((id) => existsSync(`base-styles/${id}.json`))
  .map((id) => ({
    id,
    base: JSON.parse(readFileSync(`base-styles/${id}.json`, 'utf8')) as StyleSpecification,
    mapping: MAPPINGS[id],
  }));

// Colours no base style uses, so anything else in the output must be a survivor.
const SENTINEL: ResolvedTokens = {
  land: '#202122', water: '#303132', park: '#404142',
  roadMajor: '#505152', roadMinor: '#606162', building: '#707172', boundary: '#808182',
  labelPrimary: '#909192', labelSecondary: '#a0a1a2', halo: '#b0b1b2', accent: '#c0c1c2',
};

function layerColors(style: StyleSpecification): Map<string, string> {
  const colors = new Map<string, string>();
  for (const layer of style.layers) {
    for (const property of colorProperties(layer)) {
      for (const css of collectColors((layer.paint as Record<string, unknown>)[property])) {
        colors.set(rgbKey(css)!, `${layer.id} ${property}`);
      }
    }
  }
  return colors;
}

function byId(style: StyleSpecification, id: string): LayerSpecification {
  return style.layers.find((layer) => layer.id === id)!;
}

describe.each(CASES)('$id', ({ base, mapping }) => {
  const output = applyTokens(base, SENTINEL, { mapping });

  it('needs no fallback on the local style', () => {
    const warnings: unknown[] = [];
    applyTokens(base, SENTINEL, { mapping, onWarning: (warning) => warnings.push(warning) });
    expect(warnings).toEqual([]);
  });

  it('accounts for every layer exactly once', () => {
    const rows = buildReport(base, mapping);
    expect(rows).toHaveLength(base.layers.length + (mapping.splits?.length ?? 0));
    expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining(base.layers.map((layer) => layer.id)));
    expect(new Set(rows.map((row) => row.status)).size).toBeGreaterThan(1);
  });

  it('explains every derived and hidden layer', () => {
    const silent = buildReport(base, mapping).filter((row) => row.status !== 'mapped' && !row.why);
    expect(silent.map((row) => row.id)).toEqual([]);
  });

  it('lets no original colour survive', () => {
    const originals = layerColors(base);
    const survivors = [...layerColors(output).entries()].filter(([rgb]) => originals.has(rgb));
    expect(survivors).toEqual([]);
  });

  it('removes sprite patterns, which would carry baked colours as fills', () => {
    const patterned = output.layers.filter((layer) => 'fill-pattern' in (layer.paint ?? {}));
    expect(patterned.map((layer) => layer.id)).toEqual([]);
  });

  it('does not mutate the base style and is deterministic', () => {
    const before = JSON.stringify(base);
    const first = JSON.stringify(applyTokens(base, SENTINEL, { mapping }));
    expect(JSON.stringify(base)).toBe(before);
    expect(JSON.stringify(applyTokens(base, SENTINEL, { mapping }))).toBe(first);
  });

  it('produces a valid style', () => {
    expect(validateStyleMin(output as never)).toEqual([]);
  });

  it('keeps sources, so attribution is preserved', () => {
    expect(output.sources).toEqual(base.sources);
  });

  it('never leaves a ramp flat where the original ramped', () => {
    // Flattened layers change property, and splits separate branches on purpose.
    const reshaped = new Set(mapping.splits?.map((split) => split.layerId));
    for (const layer of base.layers) {
      const after = output.layers.find((candidate) => candidate.id === layer.id);
      if (!after || after.type !== layer.type || reshaped.has(layer.id)) continue;
      for (const property of colorProperties(layer)) {
        const before = collectColors((layer.paint as Record<string, unknown>)[property]);
        const rewritten = collectColors((after.paint as Record<string, unknown>)[property]);
        expect(rewritten).toHaveLength(before.length);
        if (new Set(before).size > 1 && before.length > 1) {
          expect(new Set(rewritten).size, `${layer.id} ${property}`).toBeGreaterThan(1);
        }
      }
    }
  });

  describe.each(TOKEN_NAMES)('token %s', (token) => {
    const changed = applyTokens(base, { ...SENTINEL, [token]: '#ff00aa' }, { mapping });
    const report = buildReport(base, mapping);
    const reads = (id: string) => report.find((row) => row.id === id)!.tokens.includes(token);
    const differs = (id: string) => JSON.stringify(byId(output, id).paint) !== JSON.stringify(byId(changed, id).paint);

    it('changes exactly the layers that read it', () => {
      const ids = output.layers.map((layer) => layer.id);
      expect(ids.filter(differs)).toEqual(ids.filter(reads));
    });

    it('is read by at least one layer', () => {
      expect(report.filter((row) => row.tokens.includes(token))).not.toEqual([]);
    });
  });

  it('draws buildings flat and opaque, in exactly the token colour', () => {
    const buildings = output.layers.filter((layer) => (layer as { 'source-layer'?: string })['source-layer'] === 'building');
    expect(buildings.length).toBeGreaterThan(0);
    for (const layer of buildings) {
      expect(layer.type).toBe('fill');
      expect(Object.keys(layer.paint!).sort()).toEqual(['fill-color', 'fill-outline-color']);
      expect((layer.paint as Record<string, unknown>)['fill-color']).toBe(SENTINEL.building);
    }
  });

  it('keeps a zoom ramp in every layer that ramped on zoom', () => {
    const ramped = (value: unknown) => JSON.stringify(value).includes('"zoom"') || JSON.stringify(value).includes('"stops"');
    for (const layer of output.layers) {
      const before = byId(base, layer.id.replace(/ \(.*\)$/, '')) ?? byId(base, layer.id);
      if (!before || before.type !== layer.type) continue;
      for (const property of colorProperties(before)) {
        const original = (before.paint as Record<string, unknown>)[property];
        if (ramped(original)) expect(ramped((layer.paint as Record<string, unknown>)[property]), layer.id).toBe(true);
      }
    }
  });

  it('keeps layer visibility metadata on split layers', () => {
    for (const split of mapping.splits ?? []) {
      expect(byId(output, split.newId).metadata).toHaveProperty('b2b:group');
    }
  });

  it('hides everything outside the default groups and never hides core', () => {
    const hiddenByDefault = output.layers.filter((layer) => layer.layout?.visibility === 'none');
    for (const layer of hiddenByDefault) {
      expect(layer.metadata as object).not.toHaveProperty('b2b:group', 'core');
    }
    const nothing = applyTokens(base, SENTINEL, { mapping, groups: [] });
    for (const layer of nothing.layers) {
      const isCore = (layer.metadata as Record<string, string>)['b2b:group'] === 'core';
      expect(layer.layout?.visibility).toBe(isCore ? 'visible' : 'none');
    }
    expect(DEFAULT_GROUPS).toContain('core');
  });

  it('shows more labels at higher density', () => {
    const shown = (density: 'low' | 'medium' | 'high') =>
      applyTokens(base, SENTINEL, { mapping, labelDensity: density }).layers.filter(
        (layer) => layer.layout?.visibility === 'visible',
      ).length;
    expect(shown('low')).toBeLessThan(shown('medium'));
    expect(shown('medium')).toBeLessThan(shown('high'));
  });

  it('handles a dark token set', () => {
    expect(validateStyleMin(applyTokens(base, dark.tokens, { mapping }) as never)).toEqual([]);
  });
});

it('sentinel set covers all tokens', () => {
  expect(Object.keys(SENTINEL).sort()).toEqual([...TOKEN_NAMES].sort());
});

describe('road classes on Streets v2', () => {
  const streets = CASES.find(({ id }) => id === 'streets-v2');

  it.runIf(streets)('keeps secondary roads major and on by default', () => {
    const { base, mapping } = streets!;
    const output = applyTokens(base, SENTINEL, { mapping });
    const secondary = byId(output, 'Minor road (secondary)');
    expect((secondary.paint as Record<string, unknown>)['line-color']).toBe(SENTINEL.roadMajor);
    expect(secondary.layout?.visibility).toBe('visible');
    const minor = byId(output, 'Minor road');
    expect((minor.paint as Record<string, unknown>)['line-color']).toBe(SENTINEL.roadMinor);
    expect(minor.layout?.visibility).toBe('none');
  });

  it.runIf(streets)('keeps the original width ramp and a filter that excludes the class', () => {
    const { base, mapping } = streets!;
    const output = applyTokens(base, SENTINEL, { mapping });
    const original = byId(base, 'Minor road');
    const width = (layer: LayerSpecification) => (layer.paint as Record<string, unknown>)['line-width'];
    expect(width(byId(output, 'Minor road (secondary)'))).toEqual(width(original));
    expect(JSON.stringify((byId(output, 'Minor road') as { filter?: unknown }).filter)).toContain('["!in","class","secondary"]');
  });
});

describe('road classes on Liberty', () => {
  const liberty = CASES.find(({ id }) => id === 'liberty')!;
  const output = applyTokens(liberty.base, SENTINEL, { mapping: liberty.mapping });

  it('draws tertiary as a default-off minor road and secondary as major', () => {
    const tertiary = byId(output, 'road_tertiary');
    expect((tertiary.paint as Record<string, unknown>)['line-color']).toBe(SENTINEL.roadMinor);
    expect(tertiary.layout?.visibility).toBe('none');
    const secondary = byId(output, 'road_secondary_tertiary');
    expect((secondary.paint as Record<string, unknown>)['line-color']).toBe(SENTINEL.roadMajor);
    expect(secondary.layout?.visibility).toBe('visible');
  });

  it('writes split filters in the expression syntax the layer uses', () => {
    expect(JSON.stringify((byId(output, 'road_tertiary') as { filter?: unknown }).filter)).toContain(
      '["match",["get","class"],["tertiary"],true,false]',
    );
    expect(validateStyleMin(output as never)).toEqual([]);
  });
});

describe('provider drift', () => {
  const liberty = CASES.find(({ id }) => id === 'liberty')!;
  const { mapping } = liberty;
  const unknown = (layers: unknown[]) =>
    ({ ...liberty.base, layers: [...liberty.base.layers, ...layers] }) as StyleSpecification;
  const source = { source: 'openmaptiles', 'source-layer': 'new_layer' };
  const NEW_LAYERS = [
    { id: 'new fill', type: 'fill', ...source, paint: { 'fill-color': '#123456', 'fill-outline-color': '#123457' } },
    { id: 'new pattern', type: 'fill', ...source, paint: { 'fill-pattern': 'x' } },
    { id: 'new line', type: 'line', ...source, paint: { 'line-color': ['interpolate', ['linear'], ['zoom'], 1, '#123458', 9, '#123459'] } },
    { id: 'new symbol', type: 'symbol', ...source, layout: { 'text-field': 'x' }, paint: { 'text-color': '#12345a', 'text-halo-color': '#12345b' } },
    { id: 'new circle', type: 'circle', ...source, paint: { 'circle-color': '#12345c', 'circle-stroke-color': '#12345d' } },
    { id: 'new 3d', type: 'fill-extrusion', ...source, paint: { 'fill-extrusion-color': '#12345e' } },
    { id: 'new relief', type: 'hillshade', source: 'ne2_shaded', paint: { 'hillshade-accent-color': '#12345f' } },
  ];
  const collect = (style: StyleSpecification) => {
    const warnings: StyleWarning[] = [];
    return { output: applyTokens(style, SENTINEL, { mapping, onWarning: (warning) => warnings.push(warning) }), warnings };
  };

  it('restyles unknown layers by type, warns once each, and lets nothing survive', () => {
    const { output, warnings } = collect(unknown(NEW_LAYERS));
    expect(warnings.map((warning) => warning.layerId)).toEqual(NEW_LAYERS.map((layer) => layer.id));
    const colors = layerColors(output);
    for (const original of ['#123456', '#123458', '#12345a', '#12345c', '#12345e']) expect(colors.has(original)).toBe(false);
    expect(validateStyleMin(output as never)).toEqual([]);
    expect(output.layers.some((layer) => layer.id === 'new relief')).toBe(false);
    expect(byId(output, 'new 3d').type).toBe('fill');
    expect(byId(output, 'new pattern').paint).not.toHaveProperty('fill-pattern');
  });

  it('keeps new layers quiet: off by default', () => {
    const { output } = collect(unknown(NEW_LAYERS));
    for (const id of ['new fill', 'new line', 'new symbol', 'new circle', 'new 3d']) {
      expect(byId(output, id).layout?.visibility, id).toBe('none');
    }
  });

  it('warns on an unknown colour property and an unsupported expression, without throwing', () => {
    const style = structuredClone(liberty.base);
    const water = style.layers.find((layer) => layer.id === 'water')! as { paint: Record<string, unknown> };
    water.paint['fill-outline-color'] = '#123460';
    water.paint['fill-color'] = ['let', 'c', '#123461', ['var', 'c']];
    const { output, warnings } = collect(style);
    expect(warnings.map((warning) => warning.code).sort()).toEqual(['unmapped-color', 'unsupported-color']);
    expect((byId(output, 'water').paint as Record<string, unknown>)['fill-color']).toBe(SENTINEL.water);
  });

  it('skips a split whose layer has gone', () => {
    const style = { ...liberty.base, layers: liberty.base.layers.filter((layer) => layer.id !== 'road_secondary_tertiary') };
    expect(collect(style).warnings.map((warning) => warning.code)).toContain('missing-split');
  });

  it('reports drift, stale rules and pin differences', () => {
    expect(hasDrift(detectDrift(liberty.base, mapping, SENTINEL, liberty.base))).toBe(false);
    const style = unknown(NEW_LAYERS.slice(0, 1));
    style.layers = style.layers.filter((layer) => layer.id !== 'poi_transit');
    const report = detectDrift(style, mapping, SENTINEL, liberty.base);
    expect(hasDrift(report)).toBe(true);
    expect(report.added).toEqual(['new fill']);
    expect(report.removed).toEqual(['poi_transit']);
    expect(report.staleIds).toContain('poi_transit');
  });

  it('marks fallback layers as derived in the report', () => {
    const row = buildReport(unknown(NEW_LAYERS), mapping).find((candidate) => candidate.id === 'new symbol')!;
    expect(row.status).toBe('derived');
    expect(row.why).toMatch(/No mapping rule/);
  });
});
