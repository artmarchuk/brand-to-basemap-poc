// Browser-side restyling for the harness page. Pinned styles that need no palette do not use this.
import type { StyleSpecification } from 'maplibre-gl';
import { MAPPINGS } from '../src/mapping';
import { ALL_GROUPS } from '../src/mapping/types';
import { applyVisibility, createState, resolve, type BrandInput } from '../src/palette';
import { applyTokens } from '../src/style/applyTokens';
import { loadBaseStyle } from '../src/style/provider';
import type { Mode, ResolvedTokens } from '../src/tokens/types';
import { buildOverlay, withOverlay, type Bounds } from './overlay';

export { loadBaseStyle, MAPPINGS };

export async function restyleFromProvider(
  styleId: string,
  tokens: ResolvedTokens,
  key: string,
): Promise<StyleSpecification> {
  const mapping = MAPPINGS[styleId];
  const base = await loadBaseStyle(mapping, key);
  return applyTokens(base, tokens, { mapping, groups: ALL_GROUPS, labelDensity: 'high' });
}

export interface PaletteView {
  brand: BrandInput;
  mode: Mode;
  recede: number;
  overrides: Partial<ResolvedTokens>;
}

/** The whole live-update path: brand state to a finished style. */
export function buildPaletteStyle(base: StyleSpecification, styleId: string, view: PaletteView) {
  const state = createState(view.brand);
  const { tokens, visibility } = resolve({
    ...state,
    mode: view.mode,
    recede: view.recede,
    overrides: { ...state.overrides, [view.mode]: view.overrides },
  });
  // The harness shows every group, so hints are the only thing that hides layers here.
  const { groups, labelDensity } = applyVisibility(ALL_GROUPS, 'high', visibility);
  const style = applyTokens(base, tokens, { mapping: MAPPINGS[styleId], groups, labelDensity });
  return { style, tokens };
}

/** Dev-only test overlay for trying data mode against real-looking data. */
export const addOverlay = (style: StyleSpecification, bounds: Bounds, tokens: ResolvedTokens) =>
  withOverlay(style, buildOverlay(bounds), tokens);

/** Median and 95th percentile of resolve + applyTokens, in milliseconds. */
export function benchmark(base: StyleSpecification, styleId: string, view: PaletteView, runs = 40) {
  const times: number[] = [];
  for (let run = 0; run < runs + 5; run++) {
    const start = performance.now();
    buildPaletteStyle(base, styleId, view);
    if (run >= 5) times.push(performance.now() - start); // The first runs warm up the JIT.
  }
  times.sort((a, b) => a - b);
  return { median: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * 0.95)], runs };
}
