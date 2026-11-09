// Before/after captures for engine tweaks: `npx tsx scripts/capture-tweaks.ts <label>` renders a fixed set of
// shots into docs/screens/m3/tweaks/<label>/. Run it before a change as `before` and after it as `after`.
import { mkdirSync } from 'node:fs';
// @ts-expect-error: plain ESM helper shared with the other capture scripts.
import { launchChrome } from './lib-chrome.mjs';
import { CITIES } from '../src/app/cities';
import { createPresetState, samplePresetState, setSlot } from '../src/presets';

const label = process.argv[2] ?? 'after';
const PAGE = process.argv[3] ?? 'http://localhost:5179/harness/presets.html';
const OUT = `docs/screens/m3/tweaks/${label}`;
mkdirSync(OUT, { recursive: true });

const terracotta = (() => {
  let s = createPresetState('colour-field', '#C65D3B');
  for (const [k, v] of Object.entries({ deep: '#2E3A59', ink: '#2E3A59', spark: '#E9D8C4' })) s = setSlot(s, k, v);
  return s;
})();
const shots = [
  ...[12, 14, 16].map((z) => ({ file: `cf-sample-z${z}`, state: samplePresetState('colour-field'), zoom: z, city: 'zurich' })),
  ...[12, 16].map((z) => ({ file: `cf-terracotta-z${z}`, state: terracotta, zoom: z, city: 'zurich' })),
  ...[12, 16].map((z) => ({ file: `cf-lisbon-z${z}`, state: samplePresetState('colour-field'), zoom: z, city: 'lisbon' })),
  ...[12, 16].map((z) => ({ file: `si-neon-z${z}`, state: createPresetState('single-ink', '#00F0FF'), zoom: z, city: 'zurich' })),
  { file: 'si-saffron-z12', state: createPresetState('single-ink', '#F5B700'), zoom: 12, city: 'zurich' },
  { file: 'si-pastel-z12', state: createPresetState('single-ink', '#F7C6D9'), zoom: 12, city: 'zurich' },
  { file: 'si-sample-z12', state: samplePresetState('single-ink'), zoom: 12, city: 'zurich' },
];
const browser = await launchChrome({ port: 9380, width: 640, height: 440 });
for (const shot of shots) {
  const c = CITIES.find((city) => city.id === shot.city)!.center.join(',');
  const url = `${PAGE}#${new URLSearchParams({ state: JSON.stringify(shot.state), center: c, zoom: String(shot.zoom) })}`;
  const ok = await browser.open(url);
  await browser.screenshot(`${OUT}/${shot.file}.png`);
  console.log(ok ? 'ok' : 'TIMEOUT', shot.file);
}
browser.close();
