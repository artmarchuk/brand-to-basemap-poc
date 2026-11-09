// Spike captures: each spike style at a city and zoom, then one sheet per preset.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome, wait } from './lib-chrome.mjs';

const BASE = process.argv[2] ?? 'http://localhost:5179/spike/index.html';
const OUT = 'docs/spikes/presets-feasibility';
const CITIES = { zurich: [8.5417, 47.3769], kyiv: [30.5234, 50.4501], lisbon: [-9.1393, 38.7223] };
const PRESETS = ['single-ink', 'figure-ground', 'colour-field'];
const ZOOMS = [8, 12, 16];
mkdirSync(OUT, { recursive: true });
const browser = await launchChrome({ port: 9341, width: 800, height: 560 });
for (const preset of PRESETS) for (const [city, center] of Object.entries(CITIES)) for (const zoom of ZOOMS) {
  const ok = await browser.open(`${BASE}#preset=${preset}&center=${center}&zoom=${zoom}`);
  await browser.screenshot(`${OUT}/${preset}-${city}-z${zoom}.png`);
  console.log(ok ? 'ok' : 'TIMEOUT', preset, city, zoom);
}
await browser.send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1300, deviceScaleFactor: 1, mobile: false });
const page = resolve('node_modules/.cache/spike-sheet.html');
for (const preset of PRESETS) {
  const cells = Object.keys(CITIES).flatMap((city) => ZOOMS.map((zoom) => `<figure><img src="file://${resolve(OUT)}/${preset}-${city}-z${zoom}.png"><figcaption>${city} z${zoom}</figcaption></figure>`));
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1b1c20;color:#fff;font:13px system-ui}h1{margin:0;padding:6px 12px;font-size:17px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:0 3px}figure{margin:0}img{width:100%;display:block}figcaption{padding:1px 6px;opacity:.8}</style><h1>Spike: ${preset}, hand-tuned Liberty</h1><main>${cells.join('')}</main>`);
  await browser.send('Page.navigate', { url: `file://${page}` });
  await wait(1500);
  await browser.screenshot(`${OUT}/sheet-${preset}.png`);
}
browser.close();
