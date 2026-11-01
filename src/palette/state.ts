import type { Mode, ResolvedTokens } from '../tokens/types';
import { TOKEN_NAMES, type TokenName } from '../tokens/types';
import { MAX_COLORS, MIN_COLORS, normalizeHex, readBrand, type BrandInput } from './brand';
import { PaletteError } from './errors';

/** Bump when the shape changes. The URL layer will rely on this. */
export const STATE_VERSION = 1;

export type Overrides = Partial<ResolvedTokens>;

/** Everything the pipeline needs. Plain JSON, so it can be stored or put in a URL as it is. */
export interface BrandState {
  version: typeof STATE_VERSION;
  brand: BrandInput;
  mode: Mode;
  /** 0-100, used in data mode. */
  recede: number;
  overrides: Record<Mode, Overrides>;
}

export const MODES: Mode[] = ['light', 'dark', 'data'];

export function createState(input: BrandInput): BrandState {
  const read = readBrand(input);
  const brand = { colors: read.hexes, primary: read.primaryIndex };
  return { version: STATE_VERSION, brand, mode: 'light', recede: 60, overrides: { light: {}, dark: {}, data: {} } };
}

export function normalizeOverrides(overrides: unknown): Overrides {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new PaletteError('invalid-override', 'Overrides must be an object');
  }
  const result: Overrides = {};
  for (const [token, value] of Object.entries(overrides)) {
    if (!(TOKEN_NAMES as readonly string[]).includes(token)) {
      throw new PaletteError('invalid-override', `Unknown token: ${token}`);
    }
    result[token as TokenName] = normalizeHex(value);
  }
  return result;
}

/** Checks untrusted input, such as a decoded URL. Returns a clean state or throws PaletteError. */
export function parseState(raw: unknown): BrandState {
  const input = raw as Partial<BrandState> | null;
  if (!input || typeof input !== 'object') throw new PaletteError('invalid-state', 'State must be an object');
  if (input.version !== STATE_VERSION) throw new PaletteError('invalid-state', `Unsupported state version: ${String(input.version)}`);
  if (!MODES.includes(input.mode as Mode)) throw new PaletteError('invalid-state', `Unknown mode: ${String(input.mode)}`);
  if (typeof input.recede !== 'number' || !Number.isFinite(input.recede)) {
    throw new PaletteError('invalid-state', 'Recede must be a number');
  }
  const brand = readBrand(input.brand as BrandInput);
  const overrides = input.overrides as Record<string, unknown> | undefined;
  return {
    version: STATE_VERSION,
    brand: { colors: brand.hexes, primary: brand.primaryIndex },
    mode: input.mode as Mode,
    recede: Math.min(100, Math.max(0, input.recede)),
    overrides: {
      light: normalizeOverrides(overrides?.light ?? {}),
      dark: normalizeOverrides(overrides?.dark ?? {}),
      data: normalizeOverrides(overrides?.data ?? {}),
    },
  };
}

export const setBrand = (state: BrandState, brand: BrandInput): BrandState => ({ ...state, brand });

export const setOverride = (state: BrandState, mode: Mode, token: TokenName, hex: string): BrandState => ({
  ...state,
  overrides: { ...state.overrides, [mode]: { ...state.overrides[mode], [token]: normalizeHex(hex) } },
});

export function resetOverride(state: BrandState, mode: Mode, token: TokenName): BrandState {
  const rest = { ...state.overrides[mode] };
  delete rest[token];
  return { ...state, overrides: { ...state.overrides, [mode]: rest } };
}

/** Clears one mode, or every mode when none is given. */
export const resetOverrides = (state: BrandState, mode?: Mode): BrandState => ({
  ...state,
  overrides: mode ? { ...state.overrides, [mode]: {} } : { light: {}, dark: {}, data: {} },
});

export { MAX_COLORS, MIN_COLORS };
