import { describe, expect, it } from 'vitest';
import { initialBrandState, parseBrandState } from '../src/app/brandState';
import { encodeHash, serialise } from '../src/app/persist';
import { feColorMatrixValues, simulate, simulateRgb, SIMULATIONS, VISION_MATRICES, VISION_MODES, visionFilterId } from '../src/vision/simulate';
import { readFileSync } from 'node:fs';

describe('colour-vision simulation', () => {
  it('offers none and the four simulations', () => {
    expect(VISION_MODES).toEqual(['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']);
  });

  it('every matrix row sums to 1, so greys stay grey and white stays white', () => {
    for (const mode of SIMULATIONS) {
      for (const row of VISION_MATRICES[mode]) expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 4);
      for (const grey of ['#000000', '#777777', '#c8c8c8', '#ffffff']) expect(simulate(grey, mode)).toBe(grey);
    }
  });

  it('none changes nothing', () => {
    expect(simulate('#E0623F', 'none')).toBe('#e0623f');
    expect(simulateRgb([224, 98, 63], 'none')).toEqual([224, 98, 63]);
  });

  it('dichromats confuse the pairs they are known to confuse', () => {
    const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
    const gap = (a: string, b: string) => Math.max(...channels(a).map((value, index) => Math.abs(value - channels(b)[index])));
    // Pure red and a dark yellow-green of similar luminance: far apart normally, close for red-green dichromats.
    const [red, olive] = ['#ff0000', '#6f7000'];
    expect(gap(red, olive)).toBeGreaterThan(100);
    for (const mode of ['protanopia', 'deuteranopia'] as const) {
      const [r, g] = channels(simulate(red, mode));
      // Red loses its redness: the red and green channels come out close, as a yellow-brown.
      expect(Math.abs(r - g)).toBeLessThan(60);
      expect(gap(simulate(red, mode), simulate(olive, mode))).toBeLessThan(gap(red, olive) / 2);
    }
    // Tritanopia: blue and green converge; red stays red.
    expect(gap(simulate('#0000ff', 'tritanopia'), simulate('#008080', 'tritanopia'))).toBeLessThan(gap('#0000ff', '#008080'));
    expect(channels(simulate('#ff0000', 'tritanopia'))[0]).toBeGreaterThan(240);
  });

  it('achromatopsia gives a grey of the same luminance', () => {
    for (const colour of ['#e0623f', '#00f0ff', '#6b2c91', '#f5b700']) {
      const grey = simulate(colour, 'achromatopsia');
      expect(grey.slice(1, 3)).toBe(grey.slice(3, 5));
      expect(grey.slice(3, 5)).toBe(grey.slice(5, 7));
    }
    expect(simulate('#00ff00', 'achromatopsia')).toBe('#dcdcdc');
  });

  it('writes an feColorMatrix with alpha passed through', () => {
    for (const mode of SIMULATIONS) {
      const values = feColorMatrixValues(mode).split(' ').map(Number);
      expect(values).toHaveLength(20);
      expect(values.slice(15)).toEqual([0, 0, 0, 1, 0]);
      expect([values[0], values[1], values[2]]).toEqual(VISION_MATRICES[mode][0]);
      expect([values[3], values[4], values[8], values[9], values[13], values[14]]).toEqual([0, 0, 0, 0, 0, 0]);
    }
  });

  it('the stylesheet has a canvas filter rule for every simulation', () => {
    const css = readFileSync('src/ui/global.css', 'utf8');
    for (const mode of SIMULATIONS) {
      expect(css).toContain(`.map-view[data-vision='${mode}'] .maplibregl-canvas {\n  filter: url('#${visionFilterId(mode)}');`);
    }
  });

  it('is a preview only: the shared and saved state has no place for it', () => {
    const state = initialBrandState();
    const withVision = { ...state, vision: 'protanopia' };
    expect(parseBrandState(JSON.parse(JSON.stringify(withVision)))).toEqual(state);
    expect(encodeHash(parseBrandState(withVision))).toBe(encodeHash(state));
    expect(serialise(state)).not.toMatch(/vision|protanopia/);
    // Nothing in the engine, the compiler, the state or the exports imports the simulation.
    for (const file of ['src/app/brandState.ts', 'src/app/compile.ts', 'src/app/persist.ts', 'src/export/export.ts', 'src/export/tokens.ts', 'src/presets/resolve.ts', 'src/style/applyTokens.ts']) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/vision/i);
    }
  });
});
