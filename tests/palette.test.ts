import { describe, expect, it } from 'vitest';
import palettes from '../fixtures/palettes.json';
import { applyVisibility, createState, deriveTokens, PALETTE_CONFIG, PaletteError, parseState, resolve, resetOverride, resetOverrides, setBrand, setOverride, transformForMode } from '../src/palette';
import { colorDistance, contrastRatio, lightnessOf, parseColor } from '../src/tokens/color';
import { TOKEN_NAMES, type Mode, type ResolvedTokens } from '../src/tokens/types';

const HEX = /^#[0-9a-f]{6}$/;
const brandOf = (palette: (typeof palettes)[number]) => ({ colors: palette.colors, primary: palette.primary });
const at = (palette: (typeof palettes)[number], mode: Mode, recede = 60) =>
  resolve({ ...createState(brandOf(palette)), mode, recede });
const chroma = (hex: string) => parseColor(hex)!.c;

// Deterministic generator for the property tests: no real randomness anywhere.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randomBrand(random: () => number) {
  const count = 2 + Math.floor(random() * 4);
  const colors = Array.from({ length: count }, () => `#${Math.floor(random() * 0x1000000).toString(16).padStart(6, '0')}`);
  return { colors, primary: Math.floor(random() * count) };
}

const allValid = (tokens: ResolvedTokens) => TOKEN_NAMES.every((token) => HEX.test(tokens[token]));

describe('fixtures', () => {
  it('has ten palettes with fictional names and 2-5 colours', () => {
    expect(palettes).toHaveLength(10);
    for (const palette of palettes) expect(palette.colors.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...palettes.map((palette) => palette.colors.length))).toBe(5);
  });
});

describe.each(palettes)('$name', (palette) => {
  const modes: [string, Mode, number][] = [['light', 'light', 0], ['dark', 'dark', 0], ['data 0', 'data', 0], ['data 60', 'data', 60], ['data 100', 'data', 100]];

  it.each(modes)('gives valid hex for every token in %s', (_label, mode, recede) => {
    const { tokens } = at(palette, mode, recede);
    expect(Object.keys(tokens).sort()).toEqual([...TOKEN_NAMES].sort());
    expect(allValid(tokens)).toBe(true);
    for (const token of TOKEN_NAMES) expect(parseColor(tokens[token])!.l).not.toBeNaN();
  });

  it.each(['light', 'dark'] as Mode[])('keeps label contrast above target on every surface in %s', (mode) => {
    const { tokens } = at(palette, mode);
    for (const surface of ['land', 'water', 'park', 'building'] as const) {
      expect(contrastRatio(tokens.labelPrimary, tokens[surface]), `primary on ${surface}`).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(tokens.labelSecondary, tokens[surface]), `secondary on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['light', 'dark'] as Mode[])('keeps the accent readable on land in %s', (mode) => {
    const { tokens } = at(palette, mode);
    expect(contrastRatio(tokens.accent, tokens.land)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['light', 'dark'] as Mode[])('keeps the road lightness gap in %s', (mode) => {
    const { tokens } = at(palette, mode);
    expect(Math.abs(lightnessOf(tokens.roadMajor) - lightnessOf(tokens.roadMinor))).toBeGreaterThanOrEqual(
      PALETTE_CONFIG.minRoadLightnessGap,
    );
  });

  it('keeps large areas quiet in light', () => {
    const { tokens } = at(palette, 'light');
    expect(chroma(tokens.land)).toBeLessThanOrEqual(PALETTE_CONFIG.light.land.cMax + 0.003);
    expect(chroma(tokens.water)).toBeLessThanOrEqual(PALETTE_CONFIG.light.water.cMax + 0.003);
    expect(chroma(tokens.park)).toBeLessThanOrEqual(PALETTE_CONFIG.light.park.cMax + 0.003);
  });

  it('keeps water blue-ish and park green-ish, within 40 degrees of their natural hues', () => {
    const { tokens } = at(palette, 'light');
    const off = (hue: number, target: number) => Math.abs(((((hue - target) % 360) + 540) % 360) - 180);
    expect(off(parseColor(tokens.water)!.h, PALETTE_CONFIG.water.hue)).toBeLessThanOrEqual(40);
    expect(off(parseColor(tokens.park)!.h, PALETTE_CONFIG.park.hue)).toBeLessThanOrEqual(40);
  });

  it('keeps land, water and building separable in dark', () => {
    const { tokens } = at(palette, 'dark');
    for (const [a, b] of [['land', 'water'], ['land', 'building'], ['water', 'building'], ['land', 'park'], ['park', 'building']] as const) {
      expect(colorDistance(tokens[a], tokens[b]), `${a} vs ${b}`).toBeGreaterThanOrEqual(0.04);
    }
  });

  it('keeps land, water and building separable in light', () => {
    const { tokens } = at(palette, 'light');
    for (const [a, b] of [['land', 'water'], ['land', 'building'], ['land', 'park']] as const) {
      expect(colorDistance(tokens[a], tokens[b]), `${a} vs ${b}`).toBeGreaterThanOrEqual(0.04);
    }
  });

  it('is monotonic in recede: never more chroma or lightness spread', () => {
    const fills = ['land', 'water', 'park', 'building', 'roadMajor', 'roadMinor'] as const;
    const spread = (tokens: ResolvedTokens) => {
      const lights = fills.map((token) => parseColor(tokens[token])!.l);
      return Math.max(...lights) - Math.min(...lights);
    };
    const totalChroma = (tokens: ResolvedTokens) => fills.reduce((sum, token) => sum + chroma(tokens[token]), 0);
    let previous = at(palette, 'data', 0).tokens;
    for (let recede = 5; recede <= 100; recede += 5) {
      const { tokens } = at(palette, 'data', recede);
      expect(spread(tokens)).toBeLessThanOrEqual(spread(previous) + 0.004);
      expect(totalChroma(tokens)).toBeLessThanOrEqual(totalChroma(previous) + 0.004);
      previous = tokens;
    }
  });

  it('never changes labels, halo or accent in data mode', () => {
    const light = at(palette, 'light').tokens;
    const data = at(palette, 'data', 100).tokens;
    for (const token of ['labelPrimary', 'labelSecondary', 'halo', 'accent'] as const) expect(data[token]).toBe(light[token]);
  });

  it('keeps labels and accent readable in data mode at recede 100', () => {
    const { tokens } = at(palette, 'data', 100);
    for (const surface of ['land', 'water', 'park', 'building'] as const) {
      expect(contrastRatio(tokens.labelPrimary, tokens[surface]), `primary on ${surface}`).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(tokens.labelSecondary, tokens[surface]), `secondary on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(tokens.accent, tokens.land)).toBeGreaterThanOrEqual(4.5);
  });

  it('data at recede 0 equals light, exactly', () => {
    expect(at(palette, 'data', 0).tokens).toEqual(at(palette, 'light').tokens);
  });
});

describe('determinism and robustness', () => {
  it('gives the same tokens for the same input', () => {
    expect(deriveTokens(brandOf(palettes[4]))).toEqual(deriveTokens(brandOf(palettes[4])));
  });

  it('never throws, and always gives valid hex, for 300 seeded-random brands in all modes', () => {
    const random = seeded(7);
    for (let i = 0; i < 300; i++) {
      const brand = randomBrand(random);
      for (const mode of ['light', 'dark', 'data'] as Mode[]) {
        const { tokens } = resolve({ ...createState(brand), mode, recede: Math.floor(random() * 101) });
        expect(allValid(tokens), JSON.stringify(brand)).toBe(true);
      }
      expect(contrastRatio(deriveTokens(brand).labelPrimary, deriveTokens(brand).land)).toBeGreaterThanOrEqual(7);
    }
  });

  it('keeps the road gap and label contrast on random brands, light and dark', () => {
    const random = seeded(11);
    for (let i = 0; i < 150; i++) {
      const brand = randomBrand(random);
      for (const mode of ['light', 'dark'] as Mode[]) {
        const { tokens } = resolve({ ...createState(brand), mode });
        expect(Math.abs(lightnessOf(tokens.roadMajor) - lightnessOf(tokens.roadMinor)), JSON.stringify(brand)).toBeGreaterThanOrEqual(0.1);
        expect(contrastRatio(tokens.labelSecondary, tokens.land)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('accepts #rgb and uppercase, and rejects bad input with typed errors', () => {
    expect(deriveTokens({ colors: ['#F00', '#00F'], primary: 0 })).toBeDefined();
    const code = (brand: { colors: string[]; primary: number }) => {
      try {
        deriveTokens(brand);
      } catch (error) {
        return error instanceof PaletteError ? error.code : 'untyped';
      }
      return 'none';
    };
    expect(code({ colors: ['#ff0000'], primary: 0 })).toBe('too-few-colors');
    expect(code({ colors: Array(6).fill('#ff0000'), primary: 0 })).toBe('too-many-colors');
    expect(code({ colors: ['#ff0000', 'red'], primary: 0 })).toBe('invalid-hex');
    expect(code({ colors: ['#ff0000', '#12345'], primary: 0 })).toBe('invalid-hex');
    expect(code({ colors: ['#ff0000', '#00ff00'], primary: 2 })).toBe('invalid-primary');
    expect(code({ colors: ['#ff0000', '#00ff00'], primary: 0.5 })).toBe('invalid-primary');
    expect(code(null as never)).toBe('too-few-colors');
  });
});

describe('modes', () => {
  const light = deriveTokens(brandOf(palettes[2]));

  it('returns visibility hints in data mode at the thresholds', () => {
    const hints = (recede: number) => transformForMode(light, 'data', { recede }).visibility;
    expect(hints(30)).toEqual({ hidePois: false, thinMinorLabels: false });
    expect(hints(31)).toEqual({ hidePois: true, thinMinorLabels: false });
    expect(hints(61)).toEqual({ hidePois: true, thinMinorLabels: true });
    expect(transformForMode(light, 'dark').visibility).toEqual({ hidePois: false, thinMinorLabels: false });
  });

  it('turns hints into toggle state', () => {
    const state = applyVisibility(['core', 'pois', 'labels'], 'high', { hidePois: true, thinMinorLabels: true });
    expect(state).toEqual({ groups: ['core', 'labels'], labelDensity: 'low' });
    expect(applyVisibility(['core', 'pois'], 'high', { hidePois: false, thinMinorLabels: false })).toEqual({ groups: ['core', 'pois'], labelDensity: 'high' });
  });

  it('cuts chroma to the configured share at recede 100', () => {
    const data = transformForMode(light, 'data', { recede: 100 }).tokens;
    expect(chroma(data.water) / chroma(light.water)).toBeCloseTo(PALETTE_CONFIG.data.minChromaShare, 1);
  });
});

describe('state and overrides', () => {
  const base = createState(brandOf(palettes[0]));

  it('is JSON-safe and versioned', () => {
    const state = setOverride(base, 'dark', 'water', '#123456');
    expect(parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(state.version).toBe(1);
  });

  it('rejects broken state with typed errors', () => {
    const code = (raw: unknown) => {
      try {
        parseState(raw);
      } catch (error) {
        return (error as PaletteError).code;
      }
      return 'none';
    };
    expect(code(null)).toBe('invalid-state');
    expect(code({ ...base, version: 2 })).toBe('invalid-state');
    expect(code({ ...base, mode: 'sepia' })).toBe('invalid-state');
    expect(code({ ...base, recede: 'x' })).toBe('invalid-state');
    expect(code({ ...base, overrides: { light: { sky: '#000000' } } })).toBe('invalid-override');
    expect(code({ ...base, overrides: { light: { water: 'blue' } } })).toBe('invalid-hex');
    expect(code({ ...base, brand: { colors: ['#000000'], primary: 0 } })).toBe('too-few-colors');
  });

  it('clamps recede', () => {
    expect(parseState({ ...base, recede: 250 }).recede).toBe(100);
  });

  it('applies overrides per mode and reports which tokens are overridden', () => {
    const state = setOverride({ ...base, mode: 'dark' }, 'dark', 'water', '#102030');
    const dark = resolve(state);
    expect(dark.tokens.water).toBe('#102030');
    expect(dark.overriddenTokens).toEqual(['water']);
    expect(dark.stages.base.water).not.toBe('#102030');
    expect(resolve({ ...state, mode: 'light' }).tokens.water).not.toBe('#102030');
  });

  it('survives brand changes until reset', () => {
    const state = setOverride({ ...base, mode: 'light' }, 'light', 'roadMajor', '#abcdef');
    const changed = setBrand(state, brandOf(palettes[6]));
    expect(resolve(changed).tokens.roadMajor).toBe('#abcdef');
    expect(resolve(resetOverride(changed, 'light', 'roadMajor')).tokens.roadMajor).toBe(deriveTokens(brandOf(palettes[6])).roadMajor);
  });

  it('resets one mode or all of them', () => {
    let state = setOverride(setOverride(base, 'light', 'land', '#111111'), 'dark', 'land', '#222222');
    expect(resetOverrides(state, 'light').overrides).toEqual({ light: {}, dark: { land: '#222222' }, data: {} });
    expect(resetOverrides(state).overrides).toEqual({ light: {}, dark: {}, data: {} });
    state = resetOverrides(state);
    expect(resolve({ ...state, mode: 'dark' }).tokens).toEqual(resolve({ ...base, mode: 'dark' }).tokens);
  });

  it('starts data mode from light tokens including light overrides, then applies data overrides', () => {
    const state = setOverride({ ...base, mode: 'data', recede: 0 }, 'light', 'water', '#334455');
    expect(resolve(state).tokens.water).toBe('#334455');
    expect(resolve(setOverride(state, 'data', 'water', '#665544')).tokens.water).toBe('#665544');
    expect(resolve({ ...state, mode: 'dark' }).tokens.water).not.toBe('#334455');
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(base);
    setOverride(base, 'light', 'land', '#000000');
    resolve(base);
    expect(JSON.stringify(base)).toBe(before);
  });

  it('exposes each stage', () => {
    const result = resolve({ ...base, mode: 'dark' });
    expect(result.stages.base).toEqual(deriveTokens(base.brand));
    expect(result.stages.mode).not.toEqual(result.stages.base);
    expect(result.stages.overridden).toEqual(result.tokens);
  });
});
