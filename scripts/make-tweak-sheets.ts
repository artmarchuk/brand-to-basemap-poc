// Before/after sheets for the A3 tweaks, from docs/screens/m3/tweaks/{before,after}.
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
// @ts-expect-error: plain ESM helper shared with the other capture scripts.
import { launchChrome, wait } from './lib-chrome.mjs';

const T = resolve('docs/screens/m3/tweaks');
const pairs: { name: string; title: string; note: string; files: [string, string][] }[] = [
  { name: 'tweak-single-ink-labels', title: 'Single Ink: dark label on a paper halo before the ink is darkened', note: 'Neon cyan, Saffron and Pastel inks, Zurich z12. Before: the ink was darkened. After: the ink stays, the label gets a paper halo, the roads are darkened.',
    files: [['si-neon-z12', 'Neon #00F0FF z12'], ['si-neon-z16', 'Neon z16'], ['si-saffron-z12', 'Saffron #F5B700 z12'], ['si-pastel-z12', 'Pastel #F7C6D9 z12']] },
  { name: 'tweak-colour-field-roads-spark-buildings', title: 'Colour Field: road visibility, Spark highways, tonal buildings', note: 'Sample palette (Field #F59AAE, Deep #EA4A3C, Ink #3F1A8C, Spark #FFE600) and terracotta. Zurich z12, z14, z16 and Lisbon z16.',
    files: [['cf-sample-z12', 'sample z12'], ['cf-sample-z14', 'sample z14'], ['cf-sample-z16', 'sample z16'], ['cf-lisbon-z16', 'Lisbon z16'], ['cf-terracotta-z12', 'terracotta z12'], ['cf-terracotta-z16', 'terracotta z16']] },
];
const browser = await launchChrome({ port: 9381, width: 1800, height: 1000 });
const page = resolve('node_modules/.cache/tweak-sheet.html');
for (const sheet of pairs) {
  const rows = sheet.files.map(([f, caption]) => `<div class="row"><figure><img src="file://${T}/before/${f}.png"><figcaption>before · ${caption}</figcaption></figure><figure><img src="file://${T}/after/${f}.png"><figcaption>after · ${caption}</figcaption></figure></div>`).join('');
  const height = 70 + sheet.files.length * 450;
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1300, height, deviceScaleFactor: 1, mobile: false });
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1b1c20;color:#fff;font:13px system-ui}header{padding:8px 12px}h1{margin:0;font-size:18px}p{margin:2px 0 0;opacity:.8}.row{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:0 3px 3px}figure{margin:0}img{width:100%;display:block}figcaption{padding:1px 6px;opacity:.8}</style><header><h1>${sheet.title}</h1><p>${sheet.note}</p></header>${rows}`);
  await browser.send('Page.navigate', { url: `file://${page}` });
  await wait(1200);
  await browser.screenshot(`docs/screens/m3/${sheet.name}.png`);
  console.log('sheet', sheet.name);
}
browser.close();
