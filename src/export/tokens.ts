import { BRAND_STATE_VERSION, type BrandState } from '../app/brandState';
import { TILE_SOURCES, type TileSourceId } from '../style/source';
import { rgbKey } from '../tokens/color';
import { cssVariableName } from '../tokens/css';
import { SCHEMA_VERSION, TOKEN_NAMES, type ResolvedTokens, type TokenName } from '../tokens/types';

/** The key under `$extensions` that holds where the tokens came from. */
export const TOKEN_EXTENSION = 'b2b';

const DESCRIPTIONS: Record<TokenName, string> = {
  land: 'Land and the map background',
  water: 'Water',
  park: 'Parks and green areas',
  roadMajor: 'Major roads',
  roadMinor: 'Minor roads',
  building: 'Buildings',
  boundary: 'Boundaries',
  labelPrimary: 'Place labels',
  labelSecondary: 'Secondary labels',
  halo: 'Label halo',
  accent: 'Accent',
  urbanLanduse: 'Built-up land',
  roadMajorCasing: 'Major road casing',
  roadHighway: 'Motorways and trunk roads',
};

/** Six-digit lower-case hex, whatever form the token was written in. */
const hex = (colour: string) => rgbKey(colour) ?? colour;

export interface TokenExportOptions {
  /** The tile source the map is on. Only its id is written: a key never reaches the token exports. */
  source: TileSourceId;
}

export interface DtcgToken {
  $type: 'color';
  $value: string;
  $description: string;
}

export interface DtcgTokenFile {
  $description: string;
  map: Record<TokenName, DtcgToken>;
  $extensions: Record<typeof TOKEN_EXTENSION, {
    preset: string;
    primary: string;
    mode: BrandState['mode'];
    recede?: number;
    tileSource: TileSourceId;
    stateVersion: number;
    tokenSchema: string;
  }>;
}

/**
 * The resolved map tokens (after slots, auto-fix, overrides and the data transform) as a Design Tokens
 * Community Group file: one colour token each, grouped under `map`. These are the colours the map draws.
 */
export function exportTokensDtcg(tokens: ResolvedTokens, brand: BrandState, { source }: TokenExportOptions): DtcgTokenFile {
  return {
    $description: `Brand-to-Basemap map tokens: ${brand.presetId}, ${brand.primary}, ${brand.mode === 'data' ? `data mode at recede ${brand.recede}` : 'light mode'}.`,
    map: Object.fromEntries(
      TOKEN_NAMES.map((token) => [token, { $type: 'color', $value: hex(tokens[token]), $description: DESCRIPTIONS[token] }]),
    ) as Record<TokenName, DtcgToken>,
    $extensions: {
      [TOKEN_EXTENSION]: {
        preset: brand.presetId,
        primary: hex(brand.primary),
        mode: brand.mode,
        ...(brand.mode === 'data' && { recede: brand.recede }),
        tileSource: TILE_SOURCES[source].id,
        stateVersion: BRAND_STATE_VERSION,
        tokenSchema: SCHEMA_VERSION,
      },
    },
  };
}

/** The same tokens as CSS custom properties, `--b2b-<token>`, in a `:root` block. */
export function exportTokensCss(tokens: ResolvedTokens, brand: BrandState, { source }: TokenExportOptions): string {
  const mode = brand.mode === 'data' ? `data mode at recede ${brand.recede}` : 'light mode';
  const lines = TOKEN_NAMES.map((token) => `  ${cssVariableName(token)}: ${hex(tokens[token])};`);
  return `/* Brand-to-Basemap map tokens: ${brand.presetId.replace(/[^a-z0-9-]/gi, '')}, ${hex(brand.primary)}, ${mode}, ${TILE_SOURCES[source].id} tiles. */\n:root {\n${lines.join('\n')}\n}\n`;
}
