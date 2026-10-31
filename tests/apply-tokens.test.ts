import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import dark from '../harness/tokens/dark.json';
import { MAPPINGS } from '../src/mapping';
import { rgbKey } from '../src/tokens/color';
import { TOKEN_NAMES, type ResolvedTokens } from '../src/tokens/types';
import { applyTokens, DEFAULT_GROUPS } from '../src/style/applyTokens';
import { collectColors } from '../src/style/expressions';
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
