// Sheets of z4 and z16 for the palettes captured with extra zooms: styles by zoom down, modes across.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome, wait } from './lib-chrome.mjs';

const OUT = 'docs/screens/m2';
const palettes = JSON.parse(readFileSync('fixtures/palettes.json', 'utf8'));
const MODES = [['light', ''], ['dark', ''], ['data', ' 60']];
const extra = [...new Set(readdirSync(OUT).filter((file) => /^p\d+-.*-z4\.png$/.test(file)).map((file) => Number(file.match(/^p(\d+)-/)[1])))].sort((a, b) => a - b);

const browser = await launchChrome({ port: 9336, width: 1800, height: 1540 });
await browser.send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1540, deviceScaleFactor: 1, mobile: false });
const page = resolve('node_modules/.cache/zoom-sheet.html');
for (const number of extra) {
  const palette = palettes[number - 1];
  const cells = ['liberty', 'streets-v2'].flatMap((style) =>
    [4, 16].flatMap((zoom) =>
      MODES.map(([mode, suffix]) => `<figure><img src="file://${resolve(OUT)}/p${number}-${style}-${mode}-z${zoom}.png"><figcaption>${style} · z${zoom} · ${mode}${suffix}</figcaption></figure>`),
    ),
  );
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #1b1c20; color: #fff; font: 13px system-ui; }
    h1 { margin: 0; padding: 6px 12px; font-size: 17px; }
    main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 0 3px 3px; }
    figure { margin: 0; } img { width: 100%; display: block; } figcaption { padding: 1px 6px; opacity: .8; }
  </style><h1>${number}. ${palette.name} at z4 and z16</h1><main>${cells.join('')}</main>`);
  await browser.send('Page.navigate', { url: `file://${page}` });
  await wait(1500);
  await browser.screenshot(`${OUT}/zoom-${String(number).padStart(2, '0')}-${palette.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}.png`);
}
browser.close();
console.log(`zoom sheets for palettes ${extra.join(', ')}`);
