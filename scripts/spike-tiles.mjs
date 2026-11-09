// Spike: what the OpenFreeMap tiles hold per zoom, for the presets.
// Prints, per city and zoom, the share of the centre tile covered by each landuse class, buildings and parks.
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const CITIES = { zurich: [8.5417, 47.3769], kyiv: [30.5234, 50.4501], lisbon: [-9.1393, 38.7223] };
const ZOOMS = (process.argv[2] ?? '6,8,10,11,12,13,14').split(',').map(Number);
const tilejson = await (await fetch('https://tiles.openfreemap.org/planet')).json();
const template = tilejson.tiles[0];
const tileOf = ([lon, lat], z) => {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return { x: Math.floor(((lon + 180) / 360) * n), y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n) };
};
// Signed shoelace area per ring; MVT outer rings and holes have opposite signs, so the sum is the net area.
const area = (feature) => feature.loadGeometry().reduce((sum, ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i].x * ring[i + 1].y - ring[i + 1].x * ring[i].y;
  return sum + a / 2;
}, 0);

for (const [city, center] of Object.entries(CITIES)) {
  for (const z of ZOOMS) {
    const { x, y } = tileOf(center, z);
    const buf = await (await fetch(template.replace('{z}', z).replace('{x}', x).replace('{y}', y))).arrayBuffer();
    const tile = new VectorTile(new PbfReader(new Uint8Array(buf)));
    const share = (name, key) => {
      const layer = tile.layers[name];
      const out = {};
      if (!layer) return out;
      const full = layer.extent ** 2;
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        if (f.type !== 3) continue;
        const k = key ? f.properties[key] ?? '-' : 'all';
        out[k] = (out[k] ?? 0) + Math.abs(area(f)) / full;
      }
      return Object.fromEntries(Object.entries(out).filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v * 100)]));
    };
    console.log(`${city} z${z}  landuse% ${JSON.stringify(share('landuse', 'class'))}`);
    console.log(`          building% ${JSON.stringify(share('building'))} park% ${JSON.stringify(share('park'))} water% ${JSON.stringify(share('water'))} landcover% ${JSON.stringify(share('landcover', 'class'))}`);
  }
}
