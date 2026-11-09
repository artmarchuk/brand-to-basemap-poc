import type { StyleSpecification } from 'maplibre-gl';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/palettes.json';
import rolePalettes from '../fixtures/preset-palettes.json';
import { MAPPINGS } from '../src/mapping';
import {
  clearSlot,
  createPresetState,
  evaluateSource,
  ExpressionError,
  getPreset,
  measure,
  parseExpression,
  parsePresetState,
  presetDetails,
  PRESETS,
  primaryColour,
  resolvePreset,
  samplePresetState,
  setPresetOverride,
  setSlot,
  switchPreset,
  validatePreset,
  type PresetState,
} from '../src/presets';
import { PRESET_CONFIG } from '../src/presets/config';
import { applyTokens } from '../src/style/applyTokens';
import { colorDistance, contrastRatio, parseColor } from '../src/tokens/color';
import { TOKEN_NAMES } from '../src/tokens/types';

const HEX = /^#[0-9a-f]{6}$/;
const liberty = JSON.parse(readFileSync('base-styles/liberty.json', 'utf8')) as StyleSpecification;

// Seeded so failures reproduce: 120 random primaries over the whole sRGB cube.
function* randomHexes(count: number, seed = 7) {
  let state = seed;
  const next = () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < count; i++) {
    yield `#${[0, 0, 0].map(() => Math.floor(next() * 256).toString(16).padStart(2, '0')).join('')}`;
  }
}
const RANDOM = [...randomHexes(120)];

function roleState(presetId: string, palette: 'terracotta' | 'cyan-magenta'): PresetState {
  const slots = (rolePalettes as unknown as Record<string, Record<string, Record<string, string>>>)[palette][presetId];
  const preset = getPreset(presetId);
  let state = createPresetState(presetId, slots[preset.slots.find((slot) => slot.primary)!.id]);
  for (const [slot, hex] of Object.entries(slots)) state = setSlot(state, slot, hex);
  return state;
}

/** Every input the brief names: samples, the problem palettes, primary only on the fixtures, random primaries. */
const inputs = (presetId: string): [string, PresetState][] => [
  ['sample', samplePresetState(presetId)],
  ['terracotta', roleState(presetId, 'terracotta')],
  ['cyan-magenta', roleState(presetId, 'cyan-magenta')],
  ...fixtures.map((fixture): [string, PresetState] => [`primary only: ${fixture.name}`, createPresetState(presetId, fixture.colors[fixture.primary])]),
  ...RANDOM.map((hex): [string, PresetState] => [`random ${hex}`, createPresetState(presetId, hex)]),
];

describe('expressions', () => {
  const env = { a: '#6b2c91', b: '#f7f3fb' };

  it('mixes n% of the first colour into the second, in OKLCH', () => {
    expect(evaluateSource('mix(a, b, 0)', env)).toBe(evaluateSource('b', env));
    expect(evaluateSource('mix(a, b, 100)', env)).toBe(evaluateSource('a', env));
    const quarter = parseColor(evaluateSource('mix(a, b, 25)', env))!;
    expect(quarter.l).toBeGreaterThan(parseColor(env.a)!.l);
    expect(Math.abs(quarter.h - parseColor(env.a)!.h)).toBeLessThan(10);
  });

  it('dark and light set lightness and keep the hue', () => {
    const dark = parseColor(evaluateSource('dark(a)', env))!;
    const light = parseColor(evaluateSource('light(a)', env))!;
    expect(dark.l).toBeCloseTo(PRESET_CONFIG.functions.dark.l, 2);
    expect(light.l).toBeCloseTo(PRESET_CONFIG.functions.light.l, 2);
    expect(light.c).toBeLessThanOrEqual(PRESET_CONFIG.functions.light.cMax + 0.002);
    expect(Math.abs(dark.h - parseColor(env.a)!.h)).toBeLessThan(5);
  });

  it.each(RANDOM.slice(0, 40))('complement(%s) turns the hue and reaches its contrast', (hex) => {
    const complement = evaluateSource('complement(x)', { x: hex });
    expect(contrastRatio(complement, hex)).toBeGreaterThanOrEqual(PRESET_CONFIG.functions.complement.contrast);
  });

  it.each(RANDOM.slice(0, 40))('waterFor(%s) keeps its hue away from a chromatic source', (hex) => {
    const source = parseColor(hex)!;
    const water = parseColor(evaluateSource('waterFor(x)', { x: hex }))!;
    const gap = Math.abs(((((water.h - source.h) % 360) + 540) % 360) - 180);
    if (source.c >= 0.03) expect(gap).toBeGreaterThanOrEqual(PRESET_CONFIG.functions.waterFor.minHueGap - 3);
  });

  it.each([
    ['mix(a, b)', /takes 3/],
    ['nope(a)', /Unknown function/],
    ['mix(a, b, 10', /Expected/],
    ['a b', /Unexpected/],
  ])('rejects %s', (source, message) => {
    expect(() => parseExpression(source)).toThrow(ExpressionError);
    expect(() => parseExpression(source)).toThrow(message);
  });

  it('rejects unknown names when evaluating', () => {
    expect(() => evaluateSource('mix(a, c, 5)', env)).toThrow(/Unknown name "c"/);
  });
});

describe('preset files', () => {
  it('loads the three presets', () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual(['single-ink', 'figure-ground', 'colour-field']);
  });

  const broken = (change: (preset: Record<string, unknown>) => void) => {
    const copy = structuredClone(getPreset('figure-ground')) as unknown as Record<string, unknown>;
    change(copy);
    return () => validatePreset(copy);
  };

  it.each([
    ['two primaries', (p: Record<string, unknown>) => ((p.slots as { primary?: boolean }[])[1].primary = true), /exactly one primary/],
    ['an optional slot without a default', (p: Record<string, unknown>) => delete (p.slots as { default?: string }[])[1].default, /needs a default/],
    ['a default reading a later slot', (p: Record<string, unknown>) => ((p.slots as { default?: string }[])[1].default = 'green'), /not an earlier slot/],
    ['a missing token', (p: Record<string, unknown>) => delete (p.tokens as Record<string, string>).water, /no expression for token "water"/],
    ['an unknown weight', (p: Record<string, unknown>) => (((p.treatment as Record<string, { weight: string }>).roadMajor.weight = 'bold')), /road weight/],
    ['a check on an unknown ground', (p: Record<string, unknown>) => ((p.checks as { against: string[] }[])[0].against = ['sky']), /must name the tokens/],
  ])('rejects %s', (_label, change, message) => {
    expect(broken(change)).toThrow(message);
  });
});

describe.each(PRESETS.map((preset) => [preset.id, preset] as const))('%s', (presetId, preset) => {
  const cases = inputs(presetId);
  const resolved = cases.map(([label, state]) => [label, state, resolvePreset(state)] as const);

  it('is deterministic', () => {
    for (const [, state, result] of resolved.slice(0, 15)) expect(resolvePreset(state)).toEqual(result);
  });

  it('gives valid in-gamut hex for every token, slot and stage', () => {
    for (const [, , result] of resolved) {
      for (const tokens of [result.tokens, result.stages.expressions, result.stages.fixed]) {
        expect(Object.keys(tokens).sort()).toEqual([...TOKEN_NAMES].sort());
        for (const token of TOKEN_NAMES) expect(tokens[token]).toMatch(HEX);
      }
      for (const slot of result.slots) expect(slot.used).toMatch(HEX);
    }
  });

  it('puts the primary colour on an area token: land, water or built-up land', () => {
    const primary = preset.slots.find((slot) => slot.primary)!.id;
    for (const [label, , result] of resolved) {
      const used = result.slots.find((slot) => slot.id === primary)!.used;
      const areas = [result.stages.fixed.land, result.stages.fixed.water, result.stages.fixed.urbanLanduse];
      expect(areas, label).toContain(used);
    }
  });

  it('never overwrites a typed colour: a moved slot keeps its input', () => {
    for (const [, state, result] of resolved) {
      for (const slot of result.slots) if (slot.source === 'user') expect(slot.input).toBe(state.slots[slot.id]);
    }
  });

  it('passes every check after auto-fix, or records a fix for it', () => {
    const unresolved: string[] = [];
    for (const [label, , result] of resolved) {
      for (const check of result.checks) {
        if (check.pass) continue;
        if (!result.notices.some((notice) => notice.check === check.id)) unresolved.push(`${label}: ${check.id} ${check.value} < ${check.min}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('passes every check at the sample and the problem palettes', () => {
    for (const [label, , result] of resolved.slice(0, 3)) {
      expect(result.checks.filter((check) => !check.pass).map((check) => `${label}: ${check.id}`)).toEqual([]);
    }
  });

  it('passes every check on at least 95% of random primaries', () => {
    const random = resolved.filter(([label]) => label.startsWith('random'));
    const passing = random.filter(([, , result]) => result.checks.every((check) => check.pass));
    expect(passing.length / random.length).toBeGreaterThanOrEqual(0.95);
  });

  it('runs data mode: valid tokens, recede 0 is light, labels stay AA', () => {
    for (const [label, state] of cases.slice(0, 13)) {
      const light = resolvePreset(state);
      expect(resolvePreset({ ...state, mode: 'data', recede: 0 }).tokens).toEqual(light.tokens);
      for (const recede of [30, 60, 100]) {
        const data = resolvePreset({ ...state, mode: 'data', recede });
        for (const token of TOKEN_NAMES) expect(data.tokens[token]).toMatch(HEX);
        const labels = data.finalChecks.filter((check) => /label/i.test(check.id) && light.checks.find((c) => c.id === check.id)!.pass);
        expect(labels.filter((check) => !check.pass).map((check) => `${label} @${recede}: ${check.id} ${check.value}`)).toEqual([]);
      }
    }
  });

  it('compiles to a valid Liberty style with no mapping warnings', () => {
    for (const [, , result] of resolved.slice(0, 3)) {
      const warnings: unknown[] = [];
      const details = presetDetails(result.preset, {});
      const style = applyTokens(liberty, result.tokens, { mapping: MAPPINGS.liberty, groups: details.groups, labelDensity: details.labelDensity, treatment: result.treatment, onWarning: (w) => warnings.push(w) });
      expect(warnings).toEqual([]);
      expect(validateStyleMin(style)).toEqual([]);
    }
  });
});

describe('treatment in the compiled style', () => {
  const build = (presetId: string) => {
    const result = resolvePreset(samplePresetState(presetId));
    const details = presetDetails(result.preset, {});
    const style = applyTokens(liberty, result.tokens, { mapping: MAPPINGS.liberty, groups: details.groups, labelDensity: details.labelDensity, treatment: result.treatment, onWarning: () => {} });
    const layer = (id: string) => style.layers.find((candidate) => candidate.id === id) as unknown as { paint: Record<string, unknown>; layout: Record<string, unknown> };
    return { result, style, layer };
  };

  it('Single Ink: medium major roads, hairline minor roads, no casings, Paper water labels', () => {
    const { result, layer } = build('single-ink');
    expect(layer('road_motorway').paint['line-width']).toEqual(['interpolate', ['exponential', 1.2], ['zoom'], ...PRESET_CONFIG.weights.medium.flat()]);
    expect(layer('road_minor').paint['line-width']).toEqual(['interpolate', ['exponential', 1.2], ['zoom'], ...PRESET_CONFIG.weights.hairline.flat()]);
    expect(layer('road_motorway_casing').layout.visibility).toBe('none');
    expect(layer('road_area_pattern').layout.visibility).toBe('none');
    expect(layer('water_name_point_label').paint['text-color']).toBe(result.tokens.land);
    expect(layer('water_name_point_label').paint['text-halo-color']).toBe(result.tokens.water);
    expect(layer('water').paint['fill-color']).toBe(result.tokens.water);
    expect(layer('b2b_urban_landuse').layout.visibility).toBe('none');
  });

  it('Figure-Ground: fabric landuse fading into buildings, hairline casings that follow the road', () => {
    const { result, layer } = build('figure-ground');
    const urban = layer('b2b_urban_landuse');
    expect(urban.layout.visibility).toBe('visible');
    expect(urban.paint['fill-color']).toBe(result.tokens.urbanLanduse);
    expect(urban.paint['fill-opacity']).toEqual(['interpolate', ['linear'], ['zoom'], 13, 1, 14.5, 0]);
    expect(layer('building').layout.visibility).toBe('visible');
    const road = layer('road_trunk_primary').paint['line-width'] as unknown[];
    const casing = layer('road_trunk_primary_casing').paint['line-width'] as unknown[];
    expect(casing.slice(0, 4)).toEqual(road.slice(0, 4));
    expect((casing[5] as number) - (road[5] as number)).toBeCloseTo(PRESET_CONFIG.casingHairlinePx);
    expect(layer('road_minor_casing').layout.visibility).toBe('none');
    expect(layer('boundary_2').paint['line-dasharray']).toEqual([3, 2]);
  });

  it('Colour Field: the land is the field and the spark or its fallback is the accent', () => {
    const { result, layer } = build('colour-field');
    expect(layer('background').paint['background-color']).toBe(result.tokens.land);
    expect(result.tokens.land).toBe(result.slots.find((slot) => slot.id === 'field')!.used);
  });
});

describe('Figure-Ground in data mode', () => {
  it('keeps paper roads and paper parks with the land, so gaps do not turn into lines', () => {
    const light = resolvePreset(samplePresetState('figure-ground'));
    expect(light.tokens.roadMajor).toBe(light.tokens.land);
    for (const recede of [30, 60, 100]) {
      const data = resolvePreset({ ...samplePresetState('figure-ground'), mode: 'data', recede });
      expect(data.tokens.roadMajor).toBe(data.tokens.land);
      expect(data.tokens.roadMinor).toBe(data.tokens.land);
      expect(data.tokens.park).toBe(data.tokens.land);
    }
  });
});

describe('Single Ink on a bright brand', () => {
  it('keeps the neon cyan ink for the water, puts a dark label on a paper halo, and darkens only the roads', () => {
    const result = resolvePreset(createPresetState('single-ink', '#00F0FF'));
    const ink = result.slots.find((slot) => slot.id === 'ink')!;
    expect(ink.used).toBe(ink.input);
    expect(result.tokens.water).toBe('#00f0ff');
    expect(result.notices.some((notice) => notice.kind === 'pick' && notice.to === 'labelPrimary on halo')).toBe(true);
    expect(result.treatment.waterLabel).toMatchObject({ text: 'labelPrimary', halo: 'halo', haloWidth: PRESET_CONFIG.waterLabelHaloWidth });
    expect(contrastRatio(result.tokens.labelPrimary, result.tokens.halo)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(result.tokens.roadMajor, result.tokens.land)).toBeGreaterThanOrEqual(3);
    expect(parseColor(result.tokens.roadMajor)!.l).toBeLessThan(parseColor(ink.input)!.l);
    expect(Math.abs(parseColor(result.tokens.roadMajor)!.h - parseColor(ink.input)!.h)).toBeLessThan(8);
  });

  it('keeps Paper labels on the water when they already pass', () => {
    const result = resolvePreset(samplePresetState('single-ink'));
    expect(result.treatment.waterLabel).toMatchObject({ text: 'land', halo: 'water' });
    expect(result.treatment.waterLabel!.haloWidth).toBeUndefined();
  });

  it('darkens the ink only when a dark label on a halo cannot pass either', () => {
    // A mid-tone ink has no usable water label either way unless it moves: nothing here may fail silently.
    for (const hex of RANDOM.slice(0, 60)) {
      const result = resolvePreset(createPresetState('single-ink', hex));
      const ink = result.slots.find((slot) => slot.id === 'ink')!;
      const pick = result.notices.find((notice) => notice.kind === 'pick');
      if (ink.used !== ink.input) expect(pick ?? result.notices.find((notice) => notice.check === 'Water apart from paper')).toBeDefined();
    }
  });
});

describe('a label sits on its halo', () => {
  it('measures every label check against the halo as well as its listed grounds', () => {
    for (const preset of PRESETS) {
      const result = resolvePreset(samplePresetState(preset.id));
      for (const check of result.checks.filter((c) => /label/i.test(c.id) && !/^Water/.test(c.id))) {
        expect(check.against.map((ground) => ground.token), `${preset.id}: ${check.id}`).toContain('halo');
      }
    }
  });

  it('fails a label that clears its listed grounds but not its halo', () => {
    const tokens = { ...resolvePreset(samplePresetState('colour-field')).tokens, halo: '#3f1a8c' };
    const check = getPreset('colour-field').checks.find((candidate) => candidate.subject === 'labelPrimary')!;
    const result = measure(check, tokens, { text: 'land', halo: 'water' });
    expect(result.pass).toBe(false);
    expect(result.against.find((ground) => ground.token === 'halo')!.value).toBeLessThan(4.5);
  });
});

describe('Colour Field', () => {
  const inputs = fixtures.map((fixture) => resolvePreset(createPresetState('colour-field', fixture.colors[fixture.primary])));

  it('keeps roads at 2:1 (major) and 1.5:1 (minor) against the field', () => {
    for (const result of [resolvePreset(samplePresetState('colour-field')), ...inputs]) {
      expect(contrastRatio(result.stages.fixed.roadMajor, result.stages.fixed.land)).toBeGreaterThanOrEqual(2);
      expect(contrastRatio(result.stages.fixed.roadMinor, result.stages.fixed.land)).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('gives Spark a visible default role: motorways and trunk roads', () => {
    const result = resolvePreset(samplePresetState('colour-field'));
    expect(result.stages.expressions.roadHighway).toBe('#ffe600');
    expect(colorDistance(result.tokens.roadHighway, result.tokens.land)).toBeGreaterThanOrEqual(0.12);
    expect(result.tokens.roadHighway).not.toBe(result.tokens.roadMajor);
    const compiled = applyTokens(liberty, result.tokens, { mapping: MAPPINGS.liberty, treatment: result.treatment, onWarning: () => {} });
    const paint = (id: string) => (compiled.layers.find((layer) => layer.id === id)!.paint as Record<string, unknown>)['line-color'];
    expect(paint('road_trunk')).toBe(result.tokens.roadHighway);
    expect(paint('road_trunk_primary')).toBe(result.tokens.roadMajor);
    expect(JSON.stringify(paint('road_motorway'))).toContain(result.tokens.roadHighway);
  });

  it('draws tonal buildings by default, but the user can switch them off', () => {
    const preset = getPreset('colour-field');
    expect(presetDetails(preset, {}).groups).toContain('buildings');
    expect(presetDetails(preset, { buildings: false }).groups).not.toContain('buildings');
  });
});

describe('Figure-Ground derived defaults', () => {
  it.each(fixtures.map((fixture) => [fixture.name, fixture.colors[fixture.primary]]))('%s: water stands apart from fabric', (_name, hex) => {
    const result = resolvePreset(createPresetState('figure-ground', hex));
    expect(colorDistance(result.tokens.urbanLanduse, result.tokens.water)).toBeGreaterThanOrEqual(0.1);
    expect(result.tokens.park).toBe(result.tokens.land);
  });
});

describe('preset state', () => {
  const state = setPresetOverride(setSlot(samplePresetState('figure-ground'), 'water', '#123456'), 'land', '#fafafa');

  it('switching keeps the primary colour, resets the other slots and clears overrides', () => {
    const switched = switchPreset(state, 'colour-field');
    expect(switched.preset).toBe('colour-field');
    expect(primaryColour(switched)).toBe(primaryColour(state));
    expect(Object.keys(switched.slots)).toEqual(['field']);
    expect(switched.overrides).toEqual({ light: {}, data: {} });
    expect(switchPreset(state, 'figure-ground')).toBe(state);
  });

  it('applies overrides on top of auto-fix', () => {
    expect(resolvePreset(state).tokens.land).toBe('#fafafa');
    expect(resolvePreset(state).overriddenTokens).toEqual(['land']);
  });

  it('clears a slot back to its default, but never the primary', () => {
    expect(clearSlot(state, 'water').slots.water).toBeUndefined();
    expect(clearSlot(state, 'fabric')).toBe(state);
  });

  it('round-trips through JSON and rejects bad input', () => {
    expect(parsePresetState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(() => parsePresetState({ ...state, version: 1 })).toThrow(/version/);
    expect(() => parsePresetState({ ...state, preset: 'nope' })).toThrow(/Unknown preset/);
    expect(() => parsePresetState({ ...state, mode: 'dark' })).toThrow(/Unknown mode/);
    expect(() => parsePresetState({ ...state, slots: { water: '#123456' } })).toThrow(/primary/);
    expect(() => parsePresetState({ ...state, slots: { ...state.slots, sky: '#123456' } })).toThrow(/No slot/);
  });

  it('applies detail defaults, the user choices on top, and locked groups always on', () => {
    const preset = getPreset('figure-ground');
    expect(presetDetails(preset, {}).groups).toEqual(expect.arrayContaining(['core', 'labels', 'buildings', 'urbanLanduse']));
    const choices = presetDetails(preset, { buildings: false, pois: true });
    expect(choices.groups).toContain('buildings');
    expect(choices.groups).toContain('pois');
    expect(presetDetails(getPreset('single-ink'), {}).groups).not.toContain('buildings');
  });
});
