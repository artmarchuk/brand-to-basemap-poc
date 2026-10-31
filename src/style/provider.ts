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

/** Fetches a style that cannot be pinned. The key is stripped; bind it again to render. */
export async function loadBaseStyle(
  mapping: StyleMapping,
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<StyleSpecification> {
  const { styleUrl } = mapping.provider;
  if (!styleUrl) throw new Error(`${mapping.id} is pinned in the repo`);
  const encoded = encodeURIComponent(key);
  const response = await fetcher(`${styleUrl}?key=${encoded}`);
  if (!response.ok) throw new Error(`${mapping.name} returned HTTP ${response.status}`);
  const text = await response.text();
  return JSON.parse(text.replaceAll(`?key=${encoded}`, '').replaceAll(`&key=${encoded}`, ''));
}
