import { formatColor, mixColors, parseColor } from '../tokens/color';
import type { ResolvedTokens, TokenName } from '../tokens/types';

type Core = Omit<ResolvedTokens, 'urbanLanduse' | 'roadMajorCasing' | 'roadHighway'> & Partial<ResolvedTokens>;

const mix = (tokens: Core, from: TokenName, to: TokenName, amount: number) =>
  formatColor({ ...mixColors(parseColor(tokens[from]!)!, parseColor(tokens[to]!)!, amount), alpha: 1 });

/**
 * The tokens added in schema 0.3.0 and 0.4.0, derived the way the mappings drew those layers before they existed:
 * built-up land as a faint land tint, a casing as the road moved a quarter towards the primary label.
 * Used by the brand-colour engine and the M1 token sets; presets set both directly.
 */
export function withDerivedExtras(tokens: Core): ResolvedTokens {
  return {
    ...tokens,
    urbanLanduse: mix(tokens, 'land', 'labelSecondary', 0.05),
    roadMajorCasing: mix(tokens, 'roadMajor', 'labelPrimary', 0.25),
    roadHighway: tokens.roadMajor,
  } as ResolvedTokens;
}
