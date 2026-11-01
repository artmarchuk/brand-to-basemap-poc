// M2 contact sheets: for each palette, light, dark and data at recede 60 on both styles at z12.
// Palettes named in EXTRA_ZOOMS also get z4 and z16. Writes performance numbers alongside.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome, wait } from './lib-chrome.mjs';

const BASE_URL = process.argv[2] ?? 'http://localhost:4173/harness/index.html';
const EXTRA = (process.argv[3] ?? '').split(',').filter(Boolean).map(Number);
const OUT = 'docs/screens/m2';
const STYLES = ['liberty', 'streets-v2'];
const VARIANTS = [['light', 0], ['dark', 0], ['data', 60]];
const palettes = JSON.parse(readFileSync('fixtures/palettes.json', 'utf8'));

const key =
  process.env.MAPTILER_KEY ??
  (existsSync('.env.local') ? /^MAPTILER_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1].trim() : undefined);
if (!key) throw new Error('MAPTILER_KEY is not set');

const browser = await launchChrome({ port: 9335, key });
mkdirSync(OUT, { recursive: true });
const url = (style, palette, mode, recede, zoom, extra = '') =>
  `${BASE_URL}#${new URLSearchParams({ style, palette, mode, recede, zoom, shot: 1 })}${extra}`;
const failures = new Set();
const MISSING_ICON = /^warning: Image ".*" could not be loaded/;

async function shoot(style, palette, mode, recede, zoom, file) {
  const ready = await browser.open(url(style, palette, mode, recede, zoom));
  await browser.screenshot(`${OUT}/${file}.png`);
  console.log(`${ready ? 'ok     ' : 'TIMEOUT'} ${file}`);
  if (!ready) failures.add(`${file}: did not reach idle`);
  for (const problem of browser.session.problems) if (!MISSING_ICON.test(problem)) failures.add(problem.replaceAll(key, '<key>'));
}

for (const index of palettes.keys()) {
  const number = index + 1;
  for (const style of STYLES) {
    for (const [mode, recede] of VARIANTS) await shoot(style, number, mode, recede, 12, `p${number}-${style}-${mode}-z12`);
    if (EXTRA.includes(number)) {
      for (const zoom of [4, 16]) {
        for (const [mode, recede] of VARIANTS) await shoot(style, number, mode, recede, zoom, `p${number}-${style}-${mode}-z${zoom}`);
      }
    }
  }
}

// One scannable sheet per palette: Liberty on top, Streets below; light, dark, data across.
const sheetPage = resolve('node_modules/.cache/m2-sheet.html');
await browser.send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 800, deviceScaleFactor: 1, mobile: false });
for (const [index, palette] of palettes.entries()) {
  const number = index + 1;
  const cells = STYLES.flatMap((style) =>
    VARIANTS.map(([mode, recede]) => `<figure><img src="file://${resolve(OUT)}/p${number}-${style}-${mode}-z12.png"><figcaption>${style} · ${mode}${mode === 'data' ? ` ${recede}` : ''}</figcaption></figure>`),
  );
  writeFileSync(sheetPage, `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #1b1c20; color: #fff; font: 14px system-ui; }
    h1 { margin: 0; padding: 8px 12px; font-size: 18px; } h1 small { font-weight: 400; opacity: .7; margin-left: 12px; }
    main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 0 4px 4px; }
    figure { margin: 0; } img { width: 100%; display: block; } figcaption { padding: 2px 6px; opacity: .8; }
    .sw { display: flex; gap: 2px; padding: 0 12px 8px; } .sw i { width: 36px; height: 14px; display: block; border-radius: 2px; }
  </style><h1>${number}. ${palette.name}<small>${palette.colors.join('  ')} · ${palette.tests}</small></h1>
  <main>${cells.join('')}</main>`);
  await browser.send('Page.navigate', { url: `file://${sheetPage}` });
  await wait(1200);
  await browser.screenshot(`${OUT}/sheet-${String(number).padStart(2, '0')}-${palette.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '')}.png`);
}

// Performance: resolve + applyTokens inside the browser, per style, on the busiest palette.
const perf = {};
for (const style of STYLES) {
  await browser.open(url(style, 10, 'data', 60, 12, '&perf=1'));
  perf[style] = await browser.evaluate('window.perfResult');
}
writeFileSync(`${OUT}/perf.json`, `${JSON.stringify(perf, null, 2)}\n`);
console.log('perf (ms):', JSON.stringify(perf));

console.log(failures.size ? `\nProblems:\n${[...failures].join('\n')}` : '\nNo console warnings or errors.');
browser.close();
process.exit(failures.size ? 1 : 0);
