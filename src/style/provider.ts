import type { StyleSpecification } from 'maplibre-gl';
import type { StyleMapping } from '../mapping/types';

/** Binds the user's key to a style at runtime. Pinned styles and stored output stay key-free. */
export function bindProviderKey(style: StyleSpecification, mapping: StyleMapping, key: string): StyleSpecification {
  const { keyHost } = mapping.provider;
  if (!keyHost) return style;

  const withKey = (url: string) => {
    if (!url.includes(keyHost)) return url;
    return `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`;
  };
  const sources = Object.fromEntries(
    Object.entries(style.sources).map(([id, source]) => {
      const { url, tiles } = source as { url?: string; tiles?: string[] };
      return [id, { ...source, ...(url && { url: withKey(url) }), ...(tiles && { tiles: tiles.map(withKey) }) }];
    }),
  ) as StyleSpecification['sources'];

  return {
    ...style,
    sources,
    ...(style.glyphs && { glyphs: withKey(style.glyphs) }),
    ...(typeof style.sprite === 'string' && { sprite: withKey(style.sprite) }),
  };
}
