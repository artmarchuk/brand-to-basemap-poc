export const SCHEMA_VERSION = '0.3.0';

export const TOKEN_NAMES = [
  'land',
  'water',
  'park',
  'roadMajor',
  'roadMinor',
  'building',
  'boundary',
  'labelPrimary',
  'labelSecondary',
  'halo',
  'accent',
  // 0.3.0: built-up land as one fill (Figure-Ground's fabric below z13) and the casing of major roads.
  'urbanLanduse',
  'roadMajorCasing',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

/** The 13 semantic colours as hex. This is the only thing applyTokens reads. */
export type ResolvedTokens = Record<TokenName, string>;

export type Mode = 'light' | 'dark' | 'data';

/**
 * A stored token set. Only `tokens` is used in M1. `modes` and `overrides` reserve the
 * later layers of the model; see docs/token-model.md.
 */
export interface TokenSet {
  schemaVersion: typeof SCHEMA_VERSION;
  metadata: { name: string; baseStyle?: string; provider?: string };
  tokens: ResolvedTokens;
  modes?: Partial<Record<Mode, Partial<ResolvedTokens>>>;
  overrides?: Partial<Record<Mode, Partial<ResolvedTokens>>>;
}

/** Every later layer (mode transform, overrides, auto-fix) is one of these. */
export type TokenTransform = (tokens: ResolvedTokens) => ResolvedTokens;

export function resolveTokens(tokenSet: TokenSet, transforms: TokenTransform[] = []): ResolvedTokens {
  return transforms.reduce((tokens, transform) => transform(tokens), tokenSet.tokens);
}
