// OpenFreeMap vs MapTiler, for each preset's sample palette, Zurich, at z4, z8, z12 and z16.
// Renders the exported snippet (the same style the app and exports use), counts rendered features per layer
// and collects label texts on both sources, then writes one sheet per preset and a difference list.
//
//   npx tsx scripts/compare-sources.ts      (needs MAPTILER_KEY in the environment or .env.local)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { sampleState } from '../src/app/brandState';
import { ZOOM_STOPS } from '../src/app/cities';
import { compileBrand } from '../src/app/compile';
import { exportSnippet } from '../src/export/export';
import { PRESETS } from '../src/presets';
import type { TileSourceId } from '../src/style/source';
import { launchChrome, wait } from './lib-chrome.mjs';

const key = process.env.MAPTILER_KEY ?? (existsSync('.env.local') ? /^MAPTILER_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1].trim() : undefined);
if (!key) throw new Error('MAPTILER_KEY is needed');
const CACHE = 'node_modules/.cache/compare-sources';
const RAW = 'docs/screens/m4/raw';
const OUT = 'docs/screens/m4';
for (const dir of [CACHE, RAW]) mkdirSync(dir, { recursive: true });
const ZURICH: [number, number] = [8.5417, 47.3769];
const SOURCES: TileSourceId[] = ['openfreemap', 'maptiler'];

const server = createServer((request, response) => {
  const file = join(CACHE, (request.url ?? '/').split('?')[0]);
  if (!existsSync(file)) return void response.writeHead(404).end();
  response.writeHead(200, { 'content-type': 'text/html' }).end(readFileSync(file));
});
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://localhost:${(server.address() as AddressInfo).port}`;

const browser = await launchChrome({ port: 9420, width: 800, height: 560 });
const idle = async () => {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await browser.evaluate(`typeof map !== 'undefined' && map.loaded() && map.areTilesLoaded()`)) return true;
    await wait(300);
  }
  return false;
};

type Stats = { layers: Record<string, number>; labels: string[]; fonts: string[] };
const stats: Record<string, Stats> = {};
for (const preset of PRESETS) {
  const brand = sampleState(preset.id);
  const { style } = compileBrand(brand);
  for (const source of SOURCES) {
    for (const zoom of ZOOM_STOPS) {
      const name = `${preset.id}-${source}-z${zoom}`;
      writeFileSync(join(CACHE, `${name}.html`), exportSnippet(style, brand, { source, key: source === 'maptiler' ? key : undefined, center: ZURICH, zoom }));
      await browser.send('Page.navigate', { url: `${origin}/${name}.html` });
      await wait(800);
      if (!(await idle())) console.log(`${name}: timed out`);
      await wait(1200);
      stats[name] = await browser.evaluate(`(() => {
        const layers = {}; const labels = new Set();
        for (const f of map.queryRenderedFeatures()) {
          layers[f.layer.id] = (layers[f.layer.id] ?? 0) + 1;
          if (f.layer.type === 'symbol' && f.properties.name) labels.add(f.layer.id + ': ' + f.properties.name + (f.properties.name_en && f.properties.name_en !== f.properties.name ? ' / ' + f.properties.name_en : ''));
        }
        return { layers, labels: [...labels].sort(), fonts: [] };
      })()`);
      await browser.screenshot(`${RAW}/${name}.png`);
      console.log(name, Object.values(stats[name].layers).reduce((a, b) => a + b, 0), 'features');
    }
  }
}
const problems = browser.session.problems.filter((problem: string) => !/favicon/.test(problem)).map((problem: string) => problem.replaceAll(key, '<key>'));

// Sheets: OpenFreeMap on top, MapTiler below, zoom stops across.
const page = resolve(CACHE, 'sheet.html');
await browser.send('Emulation.setDeviceMetricsOverride', { width: 1640, height: 560, deviceScaleFactor: 1, mobile: false });
for (const preset of PRESETS) {
  const cells = SOURCES.flatMap((source) =>
    ZOOM_STOPS.map((zoom) => `<figure><img src="file://${resolve(RAW)}/${preset.id}-${source}-z${zoom}.png"><figcaption>${source === 'maptiler' ? 'MapTiler' : 'OpenFreeMap'} · z${zoom}</figcaption></figure>`),
  );
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #1b1c20; color: #fff; font: 13px system-ui; }
    h1 { margin: 0; padding: 6px 12px; font-size: 17px; }
    main { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; padding: 0 3px 3px; }
    figure { margin: 0; } img { width: 100%; display: block; } figcaption { padding: 1px 6px; opacity: .8; }
  </style><h1>${preset.name}, sample palette, Zurich: OpenFreeMap (top) vs MapTiler (bottom)</h1><main>${cells.join('')}</main>`);
  await browser.send('Page.navigate', { url: `file://${page}` });
  await wait(1500);
  await browser.screenshot(`${OUT}/sources-${preset.id}.png`);
}
browser.close();
server.close();

// Differences: per stop, every layer whose rendered feature count differs, and labels on one side only.
const lines = ['# OpenFreeMap vs MapTiler: rendered differences', '', 'Generated by `scripts/compare-sources.ts`. Counts are rendered features in an 800×560 view of Zurich.', ''];
for (const preset of PRESETS) {
  lines.push(`## ${preset.name}`, '');
  for (const zoom of ZOOM_STOPS) {
    const a = stats[`${preset.id}-openfreemap-z${zoom}`];
    const b = stats[`${preset.id}-maptiler-z${zoom}`];
    const layerDiffs = [...new Set([...Object.keys(a.layers), ...Object.keys(b.layers)])]
      .filter((id) => (a.layers[id] ?? 0) !== (b.layers[id] ?? 0))
      .map((id) => `${id} ${a.layers[id] ?? 0}→${b.layers[id] ?? 0}`);
    const onlyA = a.labels.filter((label) => !b.labels.includes(label));
    const onlyB = b.labels.filter((label) => !a.labels.includes(label));
    const labelNote = onlyA.length || onlyB.length ? 'labels differ' : 'labels identical';
    lines.push(`- **z${zoom}**: ${layerDiffs.length ? `features (OpenFreeMap→MapTiler): ${layerDiffs.join(', ')}` : 'same features in every layer'}; ${labelNote}.`);
    if (onlyA.length) lines.push(`  - labels only on OpenFreeMap (${onlyA.length}): ${onlyA.slice(0, 12).join('; ')}${onlyA.length > 12 ? '; …' : ''}`);
    if (onlyB.length) lines.push(`  - labels only on MapTiler (${onlyB.length}): ${onlyB.slice(0, 12).join('; ')}${onlyB.length > 12 ? '; …' : ''}`);
  }
  lines.push('');
}
if (problems.length) lines.push('## Console', '', ...problems.slice(0, 10).map((problem: string) => `- ${problem}`), '');
writeFileSync(`${OUT}/source-differences.md`, lines.join('\n'));
writeFileSync(`${CACHE}/stats.json`, JSON.stringify(stats, null, 1));
console.log(`sheets and ${OUT}/source-differences.md written`);
