import type { ResolvedTokens, TokenName, TokenTransform } from '../tokens/types';
import { TOKEN_NAMES } from '../tokens/types';
import { PALETTE_CONFIG, type PaletteConfig } from './config';
import { deriveTokens } from './derive';
import { transformForMode, type VisibilityHints } from './modes';
import { normalizeOverrides, type BrandState, type Overrides } from './state';

export function applyOverrides(tokens: ResolvedTokens, overrides: Overrides): ResolvedTokens {
  return { ...tokens, ...normalizeOverrides(overrides) };
}

/** Auto-fix arrives in S3. Until then this slot changes nothing. */
export const autoFix: TokenTransform = (tokens) => tokens;

export interface Resolved {
  tokens: ResolvedTokens;
  visibility: VisibilityHints;
  /** Each stage on its own, so a UI can show derived against overridden. */
  stages: { base: ResolvedTokens; mode: ResolvedTokens; overridden: ResolvedTokens };
  /** Tokens whose final value comes from an override in the active mode. */
  overriddenTokens: TokenName[];
}

/**
 * brand input -> base tokens -> per-mode transform -> per-mode overrides -> auto-fix.
 * Dark derives from the base tokens. Data starts from the light tokens including light overrides.
 */
export function resolve(state: BrandState, config: PaletteConfig = PALETTE_CONFIG): Resolved {
  const base = deriveTokens(state.brand, config);
  const lightFinal = applyOverrides(base, state.overrides.light);
  const input = state.mode === 'data' ? lightFinal : base;
  const { tokens: moded, visibility } = transformForMode(input, state.mode, { recede: state.recede, config });
  const modeOverrides = state.overrides[state.mode];
  const overridden = state.mode === 'light' ? lightFinal : applyOverrides(moded, modeOverrides);

  return {
    tokens: autoFix(overridden),
    visibility,
    stages: { base, mode: state.mode === 'light' ? lightFinal : moded, overridden },
    overriddenTokens: TOKEN_NAMES.filter((token) => token in modeOverrides),
  };
}
