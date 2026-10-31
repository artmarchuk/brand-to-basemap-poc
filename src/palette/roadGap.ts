import { lightnessOf, withLightness } from '../tokens/color';
import type { ResolvedTokens, TokenTransform } from '../tokens/types';
import { PALETTE_CONFIG } from './config';

// 8-bit rounding can land short of the target, most of all near black, so the result is re-measured.
const ROUNDING_STEP = 0.002;
const MAX_ROUNDING_STEPS = 20;

/**
 * Keeps road hierarchy visible by moving roadMinor away from roadMajor. roadMajor carries the
 * brand, so it stays put. roadMinor keeps its side unless the gap does not fit on that side.
 */
export function enforceRoadGap(minGap: number = PALETTE_CONFIG.minRoadLightnessGap): TokenTransform {
  return (tokens: ResolvedTokens) => {
    const major = lightnessOf(tokens.roadMajor);
    const minor = lightnessOf(tokens.roadMinor);
    if (Math.abs(major - minor) >= minGap) return tokens;

    const preferred = minor > major ? 1 : -1;
    const direction = major + preferred * minGap >= 0 && major + preferred * minGap <= 1 ? preferred : -preferred;

    let roadMinor = tokens.roadMinor;
    for (let step = 0; step < MAX_ROUNDING_STEPS; step++) {
      roadMinor = withLightness(tokens.roadMinor, major + direction * (minGap + step * ROUNDING_STEP));
      if (Math.abs(lightnessOf(roadMinor) - major) >= minGap) break;
    }
    return { ...tokens, roadMinor };
  };
}
