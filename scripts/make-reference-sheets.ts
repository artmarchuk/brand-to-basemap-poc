// Side-by-side sheets: the Figma "Branded maps" reference frames next to our output, one sheet per preset.
// The reference frames are downloaded from the Figma file into docs/screens/m3/reference (gitignored).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error: plain ESM helper shared with the other capture scripts.
import { launchChrome, wait } from './lib-chrome.mjs';

const REF = resolve('docs/screens/m3/reference');
const RAW = resolve('docs/screens/m3/raw');
const sheets = [
  { id: 'single-ink', name: 'Single Ink', frames: [['f2', 'frame 2 (Auckland, purple)']], ours: ['zurich-z8', 'zurich-z12', 'kyiv-z12', 'lisbon-z12'], palette: 'sample (Ink #6B2C91)' },
  { id: 'figure-ground', name: 'Figure-Ground', frames: [['f5', 'frame 5'], ['f7', 'frame 7'], ['f9', 'frame 9'], ['f10', 'frame 10']], ours: ['zurich-z12', 'zurich-z16', 'kyiv-z12', 'lisbon-z12'], palette: 'sample (Fabric #E0623F, Water #7FBDB0, Paper #FBEFE0)' },
  { id: 'colour-field', name: 'Colour Field', frames: [['f1', 'frame 1'], ['f3', 'frame 3']], ours: ['zurich-z8', 'zurich-z12', 'zurich-z16', 'kyiv-z12'], palette: 'sample (Field #F59AAE, Deep #EA4A3C, Ink #3F1A8C, Spark #FFE600)' },
];
const browser = await launchChrome({ port: 9382, width: 1800, height: 900 });
const page = resolve('node_modules/.cache/ref-sheet.html');
for (const sheet of sheets) {
  const refs = sheet.frames.map(([f, caption]) => `<figure><img src="file://${REF}/${f}.png"><figcaption>reference · ${caption}</figcaption></figure>`).join('');
  const ours = sheet.ours.map((shot) => `<figure><img src="file://${RAW}/${sheet.id}-sample-${shot}.png"><figcaption>ours · ${shot.replace('-', ' ')}</figcaption></figure>`).join('');
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 900, deviceScaleFactor: 1, mobile: false });
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1b1c20;color:#fff;font:13px system-ui}header{padding:8px 12px}h1{margin:0;font-size:18px}p{margin:2px 0 0;opacity:.8}main{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 8px 8px;align-items:start}.refs{display:grid;grid-template-columns:repeat(${sheet.frames.length > 2 ? 2 : sheet.frames.length},1fr);gap:4px;align-items:start}.ours{display:grid;grid-template-columns:1fr 1fr;gap:4px}figure{margin:0}img{width:100%;display:block}figcaption{padding:1px 4px;opacity:.8}</style><header><h1>${sheet.name}: reference frames and our output</h1><p>Ours: ${sheet.palette}, OpenFreeMap Liberty, preset default detail. The references are finished designs with data and typography; the map layer is what to compare.</p></header><main><div class="refs">${refs}</div><div class="ours">${ours}</div></main>`);
  await browser.send('Page.navigate', { url: `file://${page}` });
  await wait(1500);
  const height = await browser.evaluate('document.documentElement.scrollHeight');
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1800, height, deviceScaleFactor: 1, mobile: false });
  await wait(500);
  await browser.screenshot(`docs/screens/m3/reference-${sheet.id}.png`);
  console.log('sheet', sheet.id, height);
}
browser.close();
