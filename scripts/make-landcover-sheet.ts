import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
// @ts-expect-error: plain ESM helper shared with the other capture scripts.
import { launchChrome, wait } from './lib-chrome.mjs';
const T = resolve('docs/screens/m3/landcover');
const files: [string, string][] = [['sample-kyiv-z8', 'sample · Kyiv z8'], ['sample-zurich-z8', 'sample · Zurich z8'], ['sample-nairobi-z8', 'sample · Nairobi z8'], ['sample-kyiv-z12', 'sample · Kyiv z12'], ['terracotta-zurich-z8', 'terracotta · Zurich z8'], ['terracotta-kyiv-z8', 'terracotta · Kyiv z8'], ['sample-zurich-z4', 'sample · Zurich z4']];
const browser = await launchChrome({ port: 9396, width: 1300, height: 1000 });
await browser.send('Emulation.setDeviceMetricsOverride', { width: 1300, height: 70 + files.length * 450, deviceScaleFactor: 1, mobile: false });
const rows = files.map(([f, c]) => `<div class="row"><figure><img src="file://${T}/before/${f}.png"><figcaption>before · ${c}</figcaption></figure><figure><img src="file://${T}/after/${f}.png"><figcaption>after · ${c}</figcaption></figure></div>`).join('');
writeFileSync(resolve('node_modules/.cache/lc-sheet.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1b1c20;color:#fff;font:13px system-ui}header{padding:8px 12px}h1{margin:0;font-size:18px}p{margin:2px 0 0;opacity:.8}.row{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:0 3px 3px}figure{margin:0}img{width:100%;display:block}figcaption{padding:1px 6px;opacity:.8}</style><header><h1>Colour Field: tonal landcover patches</h1><p>Farmland and rock layers added (Liberty draws neither), park tint 10% to 24% of Deep. Sample palette and terracotta.</p></header>${rows}`);
await browser.send('Page.navigate', { url: `file://${resolve('node_modules/.cache/lc-sheet.html')}` });
await wait(1500);
await browser.screenshot('docs/screens/m3/tweak-colour-field-landcover.png');
browser.close();
