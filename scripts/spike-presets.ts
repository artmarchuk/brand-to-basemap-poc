// Spike (M3 Part A): can Liberty, recoloured and patched, reach the three preset looks?
// Hand-tuned colours from the spec's sample palettes, written straight into the style JSON. No engine.
// Writes public/spike/<preset>.json and public/spike/index.html; capture with scripts/spike-capture.mjs.
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const base = JSON.parse(readFileSync('base-styles/liberty.json', 'utf8')) as StyleSpecification;
const OUT = 'public/spike';
mkdirSync(OUT, { recursive: true });

type Paint = Record<string, unknown>;
interface Look {
  land: string; water: string; park: string; building?: string; urban?: string;
  major: string; minor: string; majorCasing?: string; label: string; label2: string; halo: string;
  waterLabel: string; waterHalo: string;
  majorWidth: 'base' | 'medium'; minorWidth: 'base' | 'hairline'; casing: 'none' | 'hairline' | 'base';
}

const HAIRLINE = ['interpolate', ['exponential', 1.2], ['zoom'], 12, 0.4, 14, 0.7, 16, 1, 20, 2.5];
const MEDIUM = ['interpolate', ['exponential', 1.2], ['zoom'], 5, 0.5, 8, 1, 12, 1.8, 16, 3.5, 20, 8];
const MAJOR = /(motorway|trunk_primary|secondary_tertiary|link)/;
const MINOR = /(service_track|street|minor|path_pedestrian)/;

// Adds `px` to every output of a zoom interpolate, so a casing hugs its fill by a fixed hairline.
function widen(width: unknown, px: number): unknown {
  if (!Array.isArray(width) || width[0] !== 'interpolate') return width;
  return width.map((value, i) => (i >= 4 && i % 2 === 1 ? (value as number) + px : value));
}

function build(look: Look): StyleSpecification {
  const fills = new Map<string, unknown>();
  const layers: LayerSpecification[] = [];
  for (const original of base.layers) {
    const layer = structuredClone(original) as LayerSpecification & { paint: Paint; layout?: Paint; 'source-layer'?: string };
    const id = layer.id;
    const src = layer['source-layer'];
    const raw = layer.paint ?? (layer.paint = {});
    // Only properties that belong to the layer's type are kept, so one rule can name fill and line together.
    const prefix = layer.type === 'fill-extrusion' ? 'fill-extrusion' : layer.type === 'symbol' ? 'text' : layer.type;
    const paint = new Proxy(raw, { set: (target, key, value) => { if (String(key).startsWith(prefix + '-')) target[key as string] = value; return true; } });
    const hide = () => { layer.layout = { ...layer.layout, visibility: 'none' }; };
    if (layer.type === 'raster') continue;
    if (id === 'background') paint['background-color'] = look.land;
    else if (src === 'park' || (src === 'landcover' && /wood|grass/.test(id))) { paint['fill-color'] = look.park; paint['fill-outline-color'] = look.park; paint['line-color'] = look.park; paint['fill-opacity'] = 1; }
    else if (src === 'landcover') paint['fill-color'] = look.land;
    else if (src === 'landuse') hide();
    else if (src === 'water' || src === 'waterway') { if (layer.type === 'symbol') hide(); else { paint['fill-color'] = look.water; paint['line-color'] = look.water; } }
    else if (src === 'transportation' && layer.type === 'line') {
      const casing = id.endsWith('_casing');
      const major = MAJOR.test(id);
      const minor = MINOR.test(id) || /rail/.test(id);
      if (/rail/.test(id)) hide();
      else if (casing) {
        if (!major || look.casing === 'none') hide();
        else { paint['line-color'] = look.majorCasing ?? look.major; if (look.casing === 'hairline') fills.set(id, null); }
      } else if (major) {
        paint['line-color'] = look.major;
        if (look.majorWidth === 'medium') paint['line-width'] = MEDIUM;
        fills.set(id.replace(/$/, '_casing'), paint['line-width']);
      } else if (minor) {
        paint['line-color'] = look.minor;
        if (look.minorWidth === 'hairline') paint['line-width'] = HAIRLINE;
        layer.minzoom = Math.max(layer.minzoom ?? 0, 13);
      }
    } else if (src === 'transportation' || src === 'aeroway' || src === 'poi' || src === 'aerodrome_label' || src === 'boundary') hide();
    else if (src === 'building') {
      if (!look.building) hide();
      else { (layer as { type: string }).type = 'fill'; layer.paint = { 'fill-color': look.building, 'fill-outline-color': look.building }; }
    } else if (src === 'water_name') { paint['text-color'] = look.waterLabel; paint['text-halo-color'] = look.waterHalo; }
    else if (src === 'transportation_name') hide();
    else if (src === 'place') {
      paint['text-color'] = /village|other|state/.test(id) ? look.label2 : look.label;
      paint['text-halo-color'] = look.halo;
      if (/village|other/.test(id)) hide();
    }
    layers.push(layer);
    // Urban landuse: residential, commercial, industrial and retail as one opaque fabric fill, under the water.
    if (id === 'landuse_residential' && look.urban) {
      layers.push({
        id: 'spike_urban', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['residential', 'commercial', 'industrial', 'retail'], true, false],
        paint: { 'fill-color': look.urban, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 1, 14.5, 0] },
      } as LayerSpecification);
    }
  }
  // Hairline casings: the fill's own width plus a pixel.
  for (const layer of layers as (LayerSpecification & { paint: Paint })[]) {
    if (fills.has(layer.id) && look.casing === 'hairline') {
      const fill = layers.find((candidate) => candidate.id === layer.id.replace(/_casing$/, '')) as { paint: Paint } | undefined;
      if (fill) layer.paint['line-width'] = widen(fill.paint['line-width'], 1.2);
    }
  }
  return { ...base, layers };
}

const LOOKS: Record<string, Look> = {
  // Ink #6B2C91. Paper is a near-white at the ink hue.
  'single-ink': {
    land: '#f8f4fa', water: '#6b2c91', park: '#e9dff0', major: '#6b2c91', minor: '#6b2c91', label: '#3d1356', label2: '#80609a',
    halo: '#f8f4fa', waterLabel: '#f8f4fa', waterHalo: '#6b2c91', majorWidth: 'medium', minorWidth: 'hairline', casing: 'none',
  },
  // Fabric #E0623F, Water #7FBDB0, Paper #FBEFE0. Parks are paper.
  'figure-ground': {
    land: '#fbefe0', water: '#7fbdb0', park: '#fbefe0', building: '#e0623f', urban: '#e0623f', major: '#fbefe0', minor: '#fbefe0',
    majorCasing: '#eeae94', label: '#5a1a08', label2: '#3f5f58', halo: '#fbefe0', waterLabel: '#2f5a51', waterHalo: '#7fbdb0',
    majorWidth: 'base', minorWidth: 'base', casing: 'hairline',
  },
  // Field #F59AAE, Deep #EA4A3C, Ink #3F1A8C, Spark #FFE600. Tonal roads, no casings.
  'colour-field': {
    land: '#f59aae', water: '#ea4a3c', park: '#f1909f', major: '#fbcad4', minor: '#f8b6c4', label: '#3f1a8c', label2: '#6a3a93',
    halo: '#f59aae', waterLabel: '#3f1a8c', waterHalo: '#ea4a3c', majorWidth: 'base', minorWidth: 'base', casing: 'none',
  },
};

for (const [id, look] of Object.entries(LOOKS)) writeFileSync(`${OUT}/${id}.json`, JSON.stringify(build(look)));
writeFileSync(`${OUT}/index.html`, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/harness/vendor/maplibre-gl.css">
<style>html,body,#map{height:100%;margin:0}</style><div id="map"></div><script type="module">
import { Map, setWorkerUrl } from '/harness/vendor/maplibre-gl.mjs';
setWorkerUrl('/harness/vendor/maplibre-gl-worker.mjs');
const p = new URLSearchParams(location.hash.slice(1));
const map = new Map({ container: 'map', style: './' + p.get('preset') + '.json', center: p.get('center').split(',').map(Number), zoom: Number(p.get('zoom')), attributionControl: { compact: true } });
map.once('idle', () => { window.mapIdle = true; });
</script>`);
console.log(`wrote ${Object.keys(LOOKS).length} spike styles to ${OUT}`);
