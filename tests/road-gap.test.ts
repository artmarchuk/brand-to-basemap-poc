import { describe, expect, it } from 'vitest';
import brand from '../harness/tokens/brand.json';
import dark from '../harness/tokens/dark.json';
import neutral from '../harness/tokens/neutral.json';
import { PALETTE_CONFIG } from '../src/palette/config';
import { enforceRoadGap } from '../src/palette/roadGap';
import { lightnessOf, parseColor } from '../src/tokens/color';
import type { ResolvedTokens } from '../src/tokens/types';

const gap = (tokens: ResolvedTokens) => Math.abs(lightnessOf(tokens.roadMajor) - lightnessOf(tokens.roadMinor));
const roads = (roadMajor: string, roadMinor: string) => ({ ...neutral.tokens, roadMajor, roadMinor });

describe('enforceRoadGap', () => {
  it('starts at the configured default', () => {
    expect(PALETTE_CONFIG.minRoadLightnessGap).toBe(0.1);
  });

  it('leaves a set that already has the gap untouched', () => {
    expect(enforceRoadGap()(brand.tokens)).toBe(brand.tokens);
    expect(enforceRoadGap()(dark.tokens)).toBe(dark.tokens);
  });

  it('fixes the flat neutral set by moving only roadMinor', () => {
    expect(gap(neutral.tokens)).toBeLessThan(0.1);
    const fixed = enforceRoadGap()(neutral.tokens);
    expect(gap(fixed)).toBeGreaterThanOrEqual(0.1);
    expect({ ...fixed, roadMinor: '' }).toEqual({ ...neutral.tokens, roadMinor: '' });
  });

  it.each([0.05, 0.1, 0.2, 0.3])('honours a configured gap of %d', (minGap) => {
    expect(gap(enforceRoadGap(minGap)(roads('#ff4d6d', '#ff5570')))).toBeGreaterThanOrEqual(minGap);
  });

  it('holds across hues and lightness, including at both ends', () => {
    for (const major of ['#ffffff', '#000000', '#00f0ff', '#f5b700', '#1b1b3a', '#888888', '#e8442e']) {
      for (const minor of ['#ffffff', '#000000', '#888888', major]) {
        expect(gap(enforceRoadGap()(roads(major, minor))), `${major} ${minor}`).toBeGreaterThanOrEqual(0.1);
      }
    }
  });

  it('keeps roadMinor on its side when the gap fits there', () => {
    const fixed = enforceRoadGap()(roads('#808080', '#858585'));
    expect(lightnessOf(fixed.roadMinor)).toBeGreaterThan(lightnessOf(fixed.roadMajor));
  });

  it('keeps the hue of roadMinor', () => {
    const before = parseColor('#ff6080')!;
    const after = parseColor(enforceRoadGap()(roads('#ff5a78', '#ff6080')).roadMinor)!;
    expect(Math.abs(after.h - before.h)).toBeLessThan(6);
  });
});
