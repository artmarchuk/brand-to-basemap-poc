import type { StyleSpecification } from 'maplibre-gl';
import type { BrandState } from '../app/brandState';
import { DATA_ANCHOR_ID, KEY_PLACEHOLDER, TILE_SOURCES, withTileSource, type TileSourceId } from '../style/source';

/** The MapLibre build the snippet loads. Kept to the version the app is tested with. */
export const MAPLIBRE_VERSION = '6.16.0';
const CDN = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist`;

export interface ExportOptions {
  source: TileSourceId;
  /** Only with an explicit opt-in: the user's MapTiler key, written into the export. */
  key?: string;
}

/**
 * The style JSON a designer pastes into their project: the compiled style for the current state, on the
 * chosen tile source, with attribution on the source and a note on the data anchor. With MapTiler and no
 * opt-in, URLs carry the `YOUR_MAPTILER_KEY` placeholder.
 */
export function exportStyle(style: StyleSpecification, brand: BrandState, { source, key }: ExportOptions): StyleSpecification {
  const tiles = TILE_SOURCES[source];
  const placed = withTileSource(style, source, tiles.needsKey ? (key ?? KEY_PLACEHOLDER) : undefined);
  return {
    ...placed,
    name: `Brand-to-Basemap: ${brand.presetId}, ${brand.primary}${brand.mode === 'data' ? `, data mode ${brand.recede}` : ''}`,
    metadata: {
      ...(placed.metadata as object),
      'b2b:export': {
        preset: brand.presetId,
        primary: brand.primary,
        mode: brand.mode,
        ...(brand.mode === 'data' && { recede: brand.recede }),
        source,
        dataAnchor: `Add your layers with beforeId '${DATA_ANCHOR_ID}' to draw them above the base map and below the labels.`,
        ...(tiles.needsKey && !key && { key: `Replace ${KEY_PLACEHOLDER} with your own MapTiler key in the source and glyph URLs.` }),
        ...(tiles.logo && { logo: 'MapTiler free plans must show the MapTiler logo on the map, linking to https://www.maptiler.com.' }),
      },
    },
  };
}

const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** JSON that is safe inside a <script> element. */
const scriptJson = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');

export interface SnippetOptions extends ExportOptions {
  center: [number, number];
  zoom: number;
}

/**
 * A complete HTML page that renders the map from a CDN build of MapLibre, with the attribution always
 * expanded and, for MapTiler, the logo. The style is inlined so the page works pasted anywhere.
 */
export function exportSnippet(style: StyleSpecification, brand: BrandState, options: SnippetOptions): string {
  const { source, key, center, zoom } = options;
  const tiles = TILE_SOURCES[source];
  // The style keeps the placeholder; the key, if any, is written once and swapped in per request.
  const exported = exportStyle(style, brand, { source });
  const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;
  const keyLines = tiles.needsKey
    ? `
// MapTiler: paste your own key. ${key ? 'This file contains your key: do not share it publicly, and restrict the key to your domain at cloud.maptiler.com.' : 'Restrict it to your domain at cloud.maptiler.com.'}
const MAPTILER_KEY = ${JSON.stringify(key ?? KEY_PLACEHOLDER)};`
    : '';
  const transform = tiles.needsKey ? `\n  transformRequest: (url) => ({ url: url.replace('${KEY_PLACEHOLDER}', MAPTILER_KEY) }),` : '';
  const logo = tiles.logo
    ? `\n<a href="${tiles.logo.href}" style="position:absolute;left:10px;bottom:10px;z-index:999;"><img src="${tiles.logo.src}" alt="${tiles.logo.alt}"></a>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(exported.name ?? 'Map')}</title>
<link rel="stylesheet" href="${CDN}/maplibre-gl.css">
<style>html, body, #map { margin: 0; height: 100%; }</style>
</head>
<body>
<div id="map"></div>${logo}
<script type="module">
import * as maplibregl from '${CDN}/maplibre-gl.mjs';
${keyLines}
const style = ${scriptJson(exported)};

const map = new maplibregl.Map({
  container: 'map',
  style,
  center: [${round(center[0], 5)}, ${round(center[1], 5)}],
  zoom: ${round(zoom, 2)},
  attributionControl: { compact: false },${transform}
});
window.map = map;

// Your data: add it with beforeId '${DATA_ANCHOR_ID}' to draw it above the base map and below the labels.
// map.on('load', () => { map.addSource('mine', { type: 'geojson', data }); map.addLayer({ id: 'mine', type: 'fill', source: 'mine' }, '${DATA_ANCHOR_ID}'); });
</script>
</body>
</html>
`;
}
