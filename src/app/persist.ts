import { parseBrandState, type BrandState } from './brandState';

/**
 * Share and autosave. The state goes in the hash as `#s=<base64url JSON>`; the same JSON goes to
 * localStorage. A hash wins over autosave. The MapTiler key has its own storage entry and is never part
 * of either, since BrandState has no field for it and parsing rebuilds the state field by field.
 */
export const HASH_PREFIX = '#s=';
export const AUTOSAVE_KEY = 'b2b:state';
export const MAPTILER_KEY_STORAGE = 'b2b:maptilerKey';

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string) => {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
};

/** Coordinates to about a metre and zoom to a hundredth: enough to restore the view, short in the URL. */
const compactView = (state: BrandState): BrandState => ({
  ...state,
  view: {
    center: [Math.round(state.view.center[0] * 1e5) / 1e5, Math.round(state.view.center[1] * 1e5) / 1e5],
    zoom: Math.round(state.view.zoom * 100) / 100,
  },
});

export const encodeHash = (state: BrandState) => `${HASH_PREFIX}${toBase64Url(JSON.stringify(compactView(state)))}`;

export type Restored = { state: BrandState; from: 'hash' | 'autosave' | 'default'; notice?: string };

/** Reads a hash. `undefined` for no state hash at all; throws for one that cannot be read. */
export function decodeHash(hash: string): BrandState | undefined {
  if (!hash || hash === '#') return undefined;
  if (!hash.startsWith(HASH_PREFIX)) throw new Error('Not a Brand-to-Basemap link');
  let json: unknown;
  try {
    json = JSON.parse(fromBase64Url(hash.slice(HASH_PREFIX.length)));
  } catch {
    throw new Error('The link is damaged');
  }
  return parseBrandState(json);
}

/** Hash, else autosave, else the default. A bad hash or autosave is reported, never thrown. */
export function restore(hash: string, saved: string | null, fallback: () => BrandState): Restored {
  try {
    const fromHash = decodeHash(hash);
    if (fromHash) return { state: fromHash, from: 'hash' };
  } catch (error) {
    return { state: fallback(), from: 'default', notice: `This link could not be opened (${(error as Error).message}). The default map is loaded.` };
  }
  if (saved) {
    try {
      return { state: parseBrandState(JSON.parse(saved)), from: 'autosave' };
    } catch {
      return { state: fallback(), from: 'default', notice: 'Your last session could not be restored. The default map is loaded.' };
    }
  }
  return { state: fallback(), from: 'default' };
}

export const serialise = (state: BrandState) => JSON.stringify(compactView(state));
