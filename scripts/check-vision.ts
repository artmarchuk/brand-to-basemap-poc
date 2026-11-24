// Checks the colour-vision preview in the real app, in headless Chrome, on both tile sources: with each
// simulation chosen, the map's pixels must be the plain map's pixels put through the same matrix
// (src/vision/simulate.ts), and the share link must not change. Run against a served build:
//
//   npm run build && npx vite preview --port 4173 &   then   npm run check-vision [url]
//
// MapTiler needs MAPTILER_KEY in the environment or .env.local; without it only OpenFreeMap is checked.
// The key goes into the page's localStorage over the debugging protocol and is never printed or saved.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { initialBrandState } from '../src/app/brandState';
import { encodeHash } from '../src/app/persist';
import { simulateRgb, SIMULATIONS } from '../src/vision/simulate';
// @ts-expect-error: plain ESM helper shared with the other capture scripts.
import { launchChrome, wait } from './lib-chrome.mjs';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const SHOTS = 'node_modules/.cache/vision-check';
mkdirSync(SHOTS, { recursive: true });
const key = process.env.MAPTILER_KEY ?? (existsSync('.env.local') ? /^MAPTILER_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1].trim() : undefined);
if (!key) console.log('No MAPTILER_KEY: MapTiler skipped.');

/** Largest channel difference allowed per pixel: rounding in the browser's filter pipeline. */
const TOLERANCE = 6;
const MIN_MATCH = 0.97;

let failed = false;
for (const source of key ? (['openfreemap', 'maptiler'] as const) : (['openfreemap'] as const)) {
  const browser = await launchChrome({ port: source === 'maptiler' ? 9421 : 9420, key: source === 'maptiler' ? key : undefined, width: 1280, height: 800 });
  // Colour Field's sample: saturated land, water, parks and roads, so every matrix moves something.
  const hash = encodeHash({ ...initialBrandState(), presetId: 'colour-field', source });
  await browser.open(`${URL}${hash}`, 45000);
  await wait(4000);
  const onSource = await browser.evaluate(`JSON.stringify(window.b2bMap.getStyle().sources.openmaptiles).includes('maptiler')`);
  const box = await browser.evaluate(`(() => { const r = document.querySelector('.maplibregl-canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  const shoot = async (name: string) => {
    const path = `${SHOTS}/${source}-${name}.png`;
    await browser.screenshot(path);
    return PNG.sync.read(readFileSync(path));
  };
  const choose = async (mode: string) => {
    await browser.evaluate(`(() => { const select = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'protanopia')); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(select, ${JSON.stringify(mode)}); select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await wait(700);
  };
  const urlBefore = await browser.evaluate('location.href');
  const plain = await shoot('none');
  // The middle of the canvas, clear of the controls drawn over the map's edges.
  const area = { x0: Math.round(box.x + box.width * 0.2), x1: Math.round(box.x + box.width * 0.8), y0: Math.round(box.y + box.height * 0.25), y1: Math.round(box.y + box.height * 0.75) };

  console.log(`\n${source}${source === 'maptiler' && !onSource ? ' (NOT on MapTiler tiles)' : ''}:`);
  if (source === 'maptiler' && !onSource) failed = true;
  for (const mode of SIMULATIONS) {
    await choose(mode);
    const filtered = await shoot(mode);
    let matched = 0, changed = 0, total = 0;
    for (let y = area.y0; y < area.y1; y += 3) {
      for (let x = area.x0; x < area.x1; x += 3) {
        const at = (y * plain.width + x) * 4;
        const before: [number, number, number] = [plain.data[at], plain.data[at + 1], plain.data[at + 2]];
        const expected = simulateRgb(before, mode);
        const after = [filtered.data[at], filtered.data[at + 1], filtered.data[at + 2]];
        total++;
        if (expected.every((channel, index) => Math.abs(channel - after[index]) <= TOLERANCE)) matched++;
        if (before.some((channel, index) => Math.abs(channel - after[index]) > TOLERANCE)) changed++;
      }
    }
    const state = await browser.evaluate(`JSON.stringify({ url: location.href, filter: getComputedStyle(document.querySelector('.maplibregl-canvas')).filter, attribution: getComputedStyle(document.querySelector('.maplibregl-ctrl-attrib')).filter, saved: localStorage.getItem('b2b:state') })`);
    const { url, filter, attribution, saved } = JSON.parse(state);
    const checks = {
      [`pixels match the matrix (${((matched / total) * 100).toFixed(1)}%, needs ${MIN_MATCH * 100}%)`]: matched / total >= MIN_MATCH,
      [`the map changed (${((changed / total) * 100).toFixed(0)}% of pixels)`]: changed / total > 0.3,
      'filter is on the canvas only': filter.includes(`b2b-vision-${mode}`) && attribution === 'none',
      'share link and autosave unchanged': url === urlBefore && !/vision|protanopia|deuteranopia|tritanopia|achromatopsia/.test(saved ?? ''),
    };
    console.log(`  ${mode}`);
    for (const [name, pass] of Object.entries(checks)) {
      console.log(`    ${pass ? 'pass' : 'FAIL'}  ${name}`);
      if (!pass) failed = true;
    }
  }
  await choose('none');
  const back = await shoot('none-again');
  let same = 0, total = 0;
  for (let y = area.y0; y < area.y1; y += 3) for (let x = area.x0; x < area.x1; x += 3) {
    const at = (y * plain.width + x) * 4;
    total++;
    if ([0, 1, 2].every((c) => Math.abs(plain.data[at + c] - back.data[at + c]) <= TOLERANCE)) same++;
  }
  const restored = same / total > 0.99;
  console.log(`  ${restored ? 'pass' : 'FAIL'}  back to none: the plain map again`);
  if (!restored) failed = true;
  browser.close();
}
process.exit(failed ? 1 : 0);
