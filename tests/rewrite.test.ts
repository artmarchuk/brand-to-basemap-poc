import { describe, expect, it } from 'vitest';
import { parseColor } from '../src/tokens/color';
import type { ResolvedTokens } from '../src/tokens/types';
import { collectColors, mapColors } from '../src/style/expressions';
import { filterClasses } from '../src/style/match';
import { rewriteColors } from '../src/style/rewrite';

const tokens = { water: '#336699', land: '#eeeeee', roadMajor: '#ffffff' } as ResolvedTokens;
const lightness = (css: string) => parseColor(css)!.l;

describe('colour walking', () => {
  it('skips interpolate inputs and match labels that look like colours', () => {
    const value = ['match', ['get', 'class'], 'tan', '#111111', ['red', 'blue'], '#222222', '#333333'];
    expect(collectColors(value)).toEqual(['#111111', '#222222', '#333333']);
  });

  it('reaches a match nested in an interpolate', () => {
    const nested = ['match', ['get', 'class'], 'a', '#111111', '#222222'];
    const value = ['interpolate', ['linear'], ['zoom'], 9, nested, 16, nested];
    expect(collectColors(value)).toHaveLength(4);
  });

  it('handles step and legacy stops', () => {
    expect(collectColors(['step', ['zoom'], '#111111', 5, '#222222'])).toHaveLength(2);
    expect(collectColors({ base: 1, stops: [[1, '#111111'], [2, '#222222']] })).toHaveLength(2);
  });

  it('keeps structure and throws on unknown operators', () => {
    const value = { base: 1.2, stops: [[1, '#111111']] };
    expect(mapColors(value, () => '#ffffff')).toEqual({ base: 1.2, stops: [[1, '#ffffff']] });
    expect(() => collectColors(['let', 'x', 1, '#111111'])).toThrow(/Unsupported/);
  });
});

describe('rewriteColors', () => {
  it('turns a literal into the token', () => {
    expect(rewriteColors('hsl(0,50%,50%)', 'water', tokens)).toBe('#336699');
  });

  it('keeps original alpha', () => {
    const color = parseColor(rewriteColors('hsla(0,50%,50%,0.4)', 'water', tokens) as string)!;
    expect(color.alpha).toBeCloseTo(0.4);
  });

  it('keeps ramp direction and lands on the token at the last stop', () => {
    const output = rewriteColors(['interpolate', ['linear'], ['zoom'], 5, '#222222', 10, '#888888'], 'water', tokens) as unknown[];
    expect(lightness(output[4] as string)).toBeLessThan(lightness(output[6] as string));
    expect(output[6]).toBe('#336699');
  });

  it('shifts a ramp that would overflow white, keeping stops distinct and ordered', () => {
    const output = rewriteColors({ stops: [[1, '#888888'], [2, '#222222']] }, 'roadMajor', tokens) as { stops: [number, string][] };
    const [first, second] = output.stops.map(([, css]) => lightness(css));
    expect(first).toBeGreaterThan(second);
    expect(first).toBeCloseTo(1, 5);
  });

  it('assigns explicit stops by position and rejects a wrong count', () => {
    const value = ['match', ['get', 'class'], 'a', '#111111', '#222222'];
    expect(rewriteColors(value, { stops: ['water', 'land'] }, tokens)).toEqual(['match', ['get', 'class'], 'a', '#336699', '#eeeeee']);
    expect(() => rewriteColors(value, { stops: ['water'] }, tokens)).toThrow(/stops/);
  });
});

describe('filterClasses', () => {
  it('reads expression and legacy filters', () => {
    expect(filterClasses(['==', ['get', 'class'], 'wood'])).toEqual(['wood']);
    expect(filterClasses(['==', 'class', 'wood'])).toEqual(['wood']);
    expect(filterClasses(['in', 'class', 'a', 'b'])).toEqual(['a', 'b']);
    expect(filterClasses(['match', ['get', 'class'], ['a', 'b'], true, false])).toEqual(['a', 'b']);
    expect(filterClasses(['all', ['==', 'class', 'a'], ['has', 'name']])).toEqual(['a']);
  });

  it('ignores negations', () => {
    expect(filterClasses(['match', ['get', 'class'], ['a'], false, true])).toEqual([]);
    expect(filterClasses(['!in', 'class', 'a'])).toEqual([]);
    expect(filterClasses(['!=', 'class', 'a'])).toEqual([]);
  });
});
