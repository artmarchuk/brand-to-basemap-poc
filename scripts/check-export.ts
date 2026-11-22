// Opens the exported embed snippet in headless Chrome, as a user would after pasting it into a blank page,
// and checks the map renders with attribution visible, on both tile sources. Then adds a GeoJSON layer with
// beforeId 'b2b-data-anchor' and checks it covers land, water and roads while labels still draw on top.
//
// MapTiler needs MAPTILER_KEY in the environment or .env.local. The snippet with the key is written only to
// node_modules/.cache (never committed) and the key is never printed. Screenshots go to docs/screens/m4/.
//
//   npx tsx scripts/check-export.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { initialState, reducer, type Action } from '../src/app/appState';
import { compileBrand } from '../src/app/compile';
import { exportSnippet } from '../src/export/export';
import { DATA_ANCHOR_ID, type TileSourceId } from '../src/style/source';
import { launchChrome, wait } from './lib-chrome.mjs';

const CACHE = 'node_modules/.cache/export-check';
const SCREENS = 'docs/screens/m4';
mkdirSync(CACHE, { recursive: true });
mkdirSync(SCREENS, { recursive: true });

const key = process.env.MAPTILER_KEY ?? (existsSync('.env.local') ? /^MAPTILER_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1].trim() : undefined);
const hide = (text: string) => (key ? text.replaceAll(key, '<key>') : text);

// A map someone made: Single Ink in a blue, in Zurich at z13.
const brand = ([{ type: 'preset', presetId: 'single-ink' }, { type: 'slot', slot: 'ink', hex: '#1d4e89' }] as Action[]).reduce(reducer, initialState()).brand;
const { style } = compileBrand(brand);
const view = { center: [8.5417, 47.3769] as [number, number], zoom: 13 };

const server = createServer((request, response) => {
  const file = join(CACHE, (request.url ?? '/').split('?')[0]);
  if (!existsSync(file)) return void response.writeHead(404).end();
  response.writeHead(200, { 'content-type': 'text/html' }).end(readFileSync(file));
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://localhost:${(server.address() as AddressInfo).port}`;

const browser = await launchChrome({ port: 9410, width: 1024, height: 700 });
const idle = async (timeoutMs = 45000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await browser.evaluate(`typeof map !== 'undefined' && map.loaded() && map.areTilesLoaded()`)) return true;
    await wait(300);
  }
  return false;
};

/** Share of pixels that are pure red, the test layer's colour. */
async function redShare(path: string) {
  const png = PNG.sync.read(readFileSync(path));
  let red = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i] > 240 && png.data[i + 1] < 20 && png.data[i + 2] < 20) red++;
  return red / (png.width * png.height);
}

const sources: TileSourceId[] = key ? ['openfreemap', 'maptiler'] : ['openfreemap'];
if (!key) console.log('No MAPTILER_KEY: MapTiler skipped.');
let failed = false;
for (const source of sources) {
  const file = `${source}.html`;
  writeFileSync(join(CACHE, file), exportSnippet(style, brand, { source, key: source === 'maptiler' ? key : undefined, ...view }));
  await browser.send('Page.navigate', { url: `${origin}/${file}` });
  await wait(1000);
  const rendered = await idle();
  await wait(500);
  const result = await browser.evaluate(`(() => {
    const attribution = document.querySelector('.maplibregl-ctrl-attrib');
    const box = attribution?.getBoundingClientRect();
    const logo = document.querySelector('img[alt="MapTiler logo"]');
    return {
      attribution: document.querySelector('.maplibregl-ctrl-attrib-inner')?.textContent ?? '',
      attributionVisible: Boolean(box && box.width > 0 && box.height > 0 && !attribution.classList.contains('maplibregl-compact')),
      logo: Boolean(logo && logo.complete && logo.naturalWidth > 0 && logo.getBoundingClientRect().width > 0),
      labels: map.queryRenderedFeatures().filter((f) => f.layer.type === 'symbol').length,
    };
  })()`);
  await browser.screenshot(`${SCREENS}/snippet-${source}.png`);

  // The anchor: a full-view red polygon added under the labels.
  await browser.evaluate(`(() => {
    const b = map.getBounds();
    map.addSource('test-data', { type: 'geojson', data: { type: 'Polygon', coordinates: [[[b.getWest(), b.getSouth()], [b.getEast(), b.getSouth()], [b.getEast(), b.getNorth()], [b.getWest(), b.getNorth()], [b.getWest(), b.getSouth()]]] } });
    map.addLayer({ id: 'test-data', type: 'fill', source: 'test-data', paint: { 'fill-color': '#ff0000' } }, '${DATA_ANCHOR_ID}');
  })()`);
  await idle();
  await wait(800);
  const order = await browser.evaluate(`(() => {
    const ids = map.getStyle().layers.map((l) => l.id);
    const at = ids.indexOf('test-data');
    const types = map.getStyle().layers.map((l) => l.type);
    return { at, anchor: ids.indexOf('${DATA_ANCHOR_ID}'), shapesAbove: types.slice(at + 1).filter((t) => t === 'fill' || t === 'line').length, symbolsAbove: types.slice(at + 1).filter((t) => t === 'symbol').length };
  })()`);
  const anchorShot = `${SCREENS}/anchor-${source}.png`;
  await browser.screenshot(anchorShot);
  const red = await redShare(anchorShot);
  const labelsAfter = await browser.evaluate(`map.queryRenderedFeatures().filter((f) => f.layer.type === 'symbol').length`);

  const checks = {
    rendered,
    'attribution visible': result.attributionVisible && /OpenStreetMap/.test(result.attribution) && (source === 'maptiler' ? /MapTiler/.test(result.attribution) : /OpenFreeMap/.test(result.attribution)),
    'logo (MapTiler only)': source === 'maptiler' ? result.logo : !result.logo,
    'labels drawn': result.labels > 0,
    'data layer just before the anchor': order.at === order.anchor - 1,
    'no fill or line above the data layer': order.shapesAbove === 0,
    'labels above the data layer': order.symbolsAbove > 0 && labelsAfter > 0,
    'data covers land, water and roads (>85% red)': red > 0.85,
    'labels still show through (<99.5% red)': red < 0.995,
  };
  console.log(`\n${source}: attribution "${hide(result.attribution)}", ${result.labels} labels, ${(red * 100).toFixed(1)}% red with the data layer`);
  for (const [name, pass] of Object.entries(checks)) {
    console.log(`  ${pass ? 'pass' : 'FAIL'}  ${name}`);
    if (!pass) failed = true;
  }
}
const problems = browser.session.problems.filter((problem: string) => !/favicon/.test(problem));
if (problems.length) console.log('\nconsole:', hide(problems.slice(0, 5).join('\n  ')));
browser.close();
server.close();
process.exit(failed ? 1 : 0);
