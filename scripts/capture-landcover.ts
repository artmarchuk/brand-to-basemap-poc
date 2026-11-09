// Before/after captures for Colour Field's tonal landcover: `npx tsx scripts/capture-landcover.ts <label>`.
import { mkdirSync } from 'node:fs';
// @ts-expect-error: plain ESM helper shared with the other capture scripts.
import { launchChrome } from './lib-chrome.mjs';
import { CITIES } from '../src/app/cities';
import { createPresetState, samplePresetState, setSlot } from '../src/presets';

const label = process.argv[2] ?? 'after';
const PAGE = process.argv[3] ?? 'http://localhost:5179/harness/presets.html';
const OUT = `docs/screens/m3/landcover/${label}`;
mkdirSync(OUT, { recursive: true });
const terracotta = (() => {
  let s = createPresetState('colour-field', '#C65D3B');
  for (const [k, v] of Object.entries({ deep: '#2E3A59', ink: '#2E3A59', spark: '#E9D8C4' })) s = setSlot(s, k, v);
  return s;
})();
const sample = samplePresetState('colour-field');
const shots = [
  { file: 'sample-zurich-z8', state: sample, city: 'zurich', zoom: 8 },
  { file: 'sample-zurich-z12', state: sample, city: 'zurich', zoom: 12 },
  { file: 'sample-kyiv-z8', state: sample, city: 'kyiv', zoom: 8 },
  { file: 'sample-kyiv-z12', state: sample, city: 'kyiv', zoom: 12 },
  { file: 'terracotta-zurich-z8', state: terracotta, city: 'zurich', zoom: 8 },
  { file: 'terracotta-kyiv-z8', state: terracotta, city: 'kyiv', zoom: 8 },
  { file: 'sample-zurich-z4', state: sample, city: 'zurich', zoom: 4 },
  { file: 'sample-nairobi-z8', state: sample, city: 'nairobi', zoom: 8 },
];
const browser = await launchChrome({ port: 9395, width: 640, height: 440 });
for (const shot of shots) {
  const c = CITIES.find((city) => city.id === shot.city)!.center.join(',');
  const ok = await browser.open(`${PAGE}#${new URLSearchParams({ state: JSON.stringify(shot.state), center: c, zoom: String(shot.zoom) })}`);
  await browser.screenshot(`${OUT}/${shot.file}.png`);
  console.log(ok ? 'ok' : 'TIMEOUT', shot.file);
}
browser.close();
