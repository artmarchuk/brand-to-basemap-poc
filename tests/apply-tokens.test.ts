import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import liberty from '../base-styles/liberty.json';
import streets from '../base-styles/streets-v2.json';
import dark from '../harness/tokens/dark.json';
import { MAPPINGS } from '../src/mapping';
import { rgbKey } from '../src/tokens/color';
import { TOKEN_NAMES, type ResolvedTokens } from '../src/tokens/types';
import { applyTokens, DEFAULT_GROUPS } from '../src/style/applyTokens';
import { collectColors } from '../src/style/expressions';
import { colorProperties } from '../src/style/match';
import { buildReport } from '../src/style/report';

const BASES = { liberty, 'streets-v2': streets } as unknown as Record<string, StyleSpecification>;
const CASES = Object.entries(BASES).map(([id, base]) => ({ id, base, mapping: MAPPINGS[id] }));

// Colours no base style uses, so anything else in the output must be a survivor.
const SENTINEL: ResolvedTokens = {
  background: '#101112', land: '#202122', water: '#303132', park: '#404142',
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
    expect(rows).toHaveLength(base.layers.length);
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
    for (const layer of base.layers) {
      const after = output.layers.find((candidate) => candidate.id === layer.id);
      if (!after) continue;
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

  it('changes only the layers that read a changed token', () => {
    const changed = applyTokens(base, { ...SENTINEL, water: '#ff00aa' }, { mapping });
    const report = buildReport(base, mapping);
    for (const after of changed.layers) {
      const before = byId(output, after.id);
      if (JSON.stringify(before.paint) === JSON.stringify(after.paint)) continue;
      expect(report.find((row) => row.id === after.id)!.assignment, after.id).toContain('water');
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
