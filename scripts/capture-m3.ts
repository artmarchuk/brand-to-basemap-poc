// M3 contact sheets for presets. Run against a server that serves public/ (npm run dev, or vite on any port):
//   npx tsx scripts/capture-m3.ts http://localhost:5179/harness/presets.html [only-sheets | file-regex]
// Raw captures go to docs/screens/m3/raw (gitignored); the sheets and checks.json are committed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error: plain ESM helper shared with the other capture scripts.
import { launchChrome, wait } from './lib-chrome.mjs';
import { CITIES } from '../src/app/cities';
import { createPresetState, PRESETS, samplePresetState, setSlot, type PresetState } from '../src/presets';

const PAGE = process.argv[2] ?? 'http://localhost:5179/harness/presets.html';
// A third argument: `only-sheets` rebuilds sheets from existing captures; anything else is a regex on file names.
const ONLY_SHEETS = process.argv[3] === 'only-sheets';
const FILTER = process.argv[3] && !ONLY_SHEETS ? new RegExp(process.argv[3]) : undefined;
const OUT = 'docs/screens/m3';
const RAW = `${OUT}/raw`;
mkdirSync(RAW, { recursive: true });

const fixtures = JSON.parse(readFileSync('fixtures/palettes.json', 'utf8')) as { name: string; colors: string[]; primary: number }[];
const rolePalettes = JSON.parse(readFileSync('fixtures/preset-palettes.json', 'utf8'));
const CITY_IDS = ['zurich', 'kyiv', 'lisbon'];
const ZOOMS = [4, 8, 12, 16];
const PALETTES = ['sample', 'terracotta', 'cyan-magenta'];

function paletteState(presetId: string, palette: string): PresetState {
  if (palette === 'sample') return samplePresetState(presetId);
  const slots: Record<string, string> = rolePalettes[palette][presetId];
  const preset = PRESETS.find((candidate) => candidate.id === presetId)!;
  let state = createPresetState(presetId, slots[preset.slots.find((slot) => slot.primary)!.id]);
  for (const [slot, hex] of Object.entries(slots)) state = setSlot(state, slot, hex);
  return state;
}

interface Shot { file: string; state: PresetState; city: string; zoom: number }
const shots: Shot[] = [];
for (const preset of PRESETS) {
  for (const palette of PALETTES) {
    for (const city of CITY_IDS) for (const zoom of ZOOMS) shots.push({ file: `${preset.id}-${palette}-${city}-z${zoom}`, state: paletteState(preset.id, palette), city, zoom });
  }
  fixtures.forEach((fixture, index) =>
    shots.push({ file: `${preset.id}-fixture${index + 1}-zurich-z12`, state: createPresetState(preset.id, fixture.colors[fixture.primary]), city: 'zurich', zoom: 12 }),
  );
  for (const zoom of [8, 12, 16]) {
    for (const [mode, recede] of [['light', 0], ['data', 60]] as const) {
      shots.push({ file: `${preset.id}-sample-${mode}${recede || ''}-zurich-z${zoom}`, state: { ...samplePresetState(preset.id), mode, recede }, city: 'zurich', zoom });
    }
  }
}

const center = (id: string) => CITIES.find((city) => city.id === id)!.center.join(',');
const url = (shot: Shot) => `${PAGE}#${new URLSearchParams({ state: JSON.stringify(shot.state), center: center(shot.city), zoom: String(shot.zoom) })}`;
const MISSING_ICON = /Image ".*" could not be loaded/;
const problems = new Set<string>();
const checks: Record<string, unknown> = {};

if (!ONLY_SHEETS) {
  const queue = shots.filter((shot) => !FILTER || FILTER.test(shot.file));
  if (FILTER && existsSync(`${OUT}/checks.json`)) Object.assign(checks, JSON.parse(readFileSync(`${OUT}/checks.json`, 'utf8')));
  const WORKERS = 3;
  await Promise.all(
    Array.from({ length: WORKERS }, async (_, worker) => {
      const browser = await launchChrome({ port: 9350 + worker, width: 640, height: 440 });
      for (let shot = queue.shift(); shot; shot = queue.shift()) {
        const ready = await browser.open(url(shot));
        await browser.screenshot(`${RAW}/${shot.file}.png`);
        if (!ready) problems.add(`${shot.file}: did not reach idle`);
        for (const problem of browser.session.problems as string[]) if (!MISSING_ICON.test(problem)) problems.add(`${shot.file}: ${problem}`);
        if (shot.zoom === 12 && shot.city === 'zurich') checks[shot.file] = await browser.evaluate('window.resolved');
        console.log(`${ready ? 'ok     ' : 'TIMEOUT'} ${shot.file}`);
      }
      browser.close();
    }),
  );
  writeFileSync(`${OUT}/checks.json`, `${JSON.stringify(checks, null, 1)}\n`);
}

// Sheets: plain HTML grids of the raw captures, screenshotted.
const browser = await launchChrome({ port: 9349, width: 1800, height: 1200 });
const page = resolve('node_modules/.cache/m3-sheet.html');
const img = (file: string, caption: string) =>
  existsSync(`${RAW}/${file}.png`) ? `<figure><img src="file://${resolve(RAW)}/${file}.png"><figcaption>${caption}</figcaption></figure>` : `<figure><figcaption>missing ${file}</figcaption></figure>`;
const swatches = (state: PresetState) => {
  const preset = PRESETS.find((candidate) => candidate.id === state.preset)!;
  return preset.slots.filter((slot) => state.slots[slot.id]).map((slot) => `<span class="sw"><i style="background:${state.slots[slot.id]}"></i>${slot.label} ${state.slots[slot.id]}</span>`).join('');
};
async function sheet(name: string, title: string, subtitle: string, columns: number, cells: string[], width = 1800) {
  const rows = Math.ceil(cells.length / columns);
  const height = 60 + rows * Math.round(((width - 6) / columns) * (440 / 640) + 22);
  await browser.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #1b1c20; color: #fff; font: 13px system-ui; }
    header { padding: 8px 12px; } h1 { margin: 0; font-size: 18px; } p { margin: 2px 0 0; opacity: .8; }
    .sw { margin-right: 14px; } .sw i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 4px; vertical-align: -2px; }
    main { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 3px; padding: 0 3px 3px; }
    figure { margin: 0; } img { width: 100%; display: block; } figcaption { padding: 1px 6px; opacity: .8; white-space: nowrap; overflow: hidden; }
  </style><header><h1>${title}</h1><p>${subtitle}</p></header><main>${cells.join('')}</main>`);
  await browser.send('Page.navigate', { url: `file://${page}` });
  await wait(1200);
  await browser.screenshot(`${OUT}/${name}.png`);
  console.log(`sheet ${name}`);
}

const cityName = (id: string) => CITIES.find((city) => city.id === id)!.name;
for (const preset of PRESETS) {
  for (const palette of PALETTES) {
    const cells = CITY_IDS.flatMap((city) => ZOOMS.map((zoom) => img(`${preset.id}-${palette}-${city}-z${zoom}`, `${cityName(city)} z${zoom}`)));
    await sheet(`${preset.id}-${palette}`, `${preset.name} · ${palette}`, swatches(paletteState(preset.id, palette)), 4, cells);
  }
  const fixtureCells = fixtures.map((fixture, index) => img(`${preset.id}-fixture${index + 1}-zurich-z12`, `${index + 1}. ${fixture.name} · primary ${fixture.colors[fixture.primary]}`));
  await sheet(`${preset.id}-fixtures-primary-only`, `${preset.name} · primary colour only, 10 fixtures`, 'Zurich z12. Every other slot is its derived default.', 5, fixtureCells);
}
const dataCells = PRESETS.flatMap((preset) => [8, 12, 16].flatMap((zoom) => [
  img(`${preset.id}-sample-light-zurich-z${zoom}`, `${preset.name} z${zoom} light`),
  img(`${preset.id}-sample-data60-zurich-z${zoom}`, `${preset.name} z${zoom} data 60`),
]));
await sheet('data-mode-recede-60', 'Data mode at recede 60 on each preset', 'Sample palettes, Zurich. Light and data side by side.', 6, dataCells);

// Variability: one palette across the presets, one preset across five palettes.
await sheet('variability-one-palette', 'Same palette, three presets', 'Terracotta Co. (#C65D3B, #E9D8C4, #5B6B4F, #2E3A59), Zurich and Kyiv z12', 3,
  ['zurich', 'kyiv'].flatMap((city) => PRESETS.map((preset) => img(`${preset.id}-terracotta-${city}-z12`, `${preset.name} · ${cityName(city)}`))), 1500);
const five = [0, 2, 4, 6, 8];
await sheet('variability-one-preset', 'Same preset, five palettes', 'Primary colour only, Zurich z12', 5,
  PRESETS.flatMap((preset) => five.map((i) => img(`${preset.id}-fixture${i + 1}-zurich-z12`, `${preset.name} · ${fixtures[i].name}`))));

browser.close();
console.log(problems.size ? `\nProblems:\n${[...problems].join('\n')}` : '\nNo console warnings or errors.');
process.exit(problems.size ? 1 : 0);
