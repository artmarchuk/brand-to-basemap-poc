// Records the demo for the README with Playwright: pick a preset, change the primary colour, switch
// presets, go through the zoom stops, open Export. Under 30 seconds. Needs Google Chrome and ffmpeg.
//
//   npm run demo                      records the live build
//   npm run demo -- http://localhost:4173/   records a local `vite preview`
//
// Writes docs/screens/demo/demo.mp4 and demo.gif. No key is involved: the demo runs on OpenFreeMap.
/* global window, document -- the functions passed to Playwright run in the page. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const URL = process.argv[2] ?? 'https://artmarchuk.github.io/brand-to-basemap-poc/';
const OUT = 'docs/screens/demo';
const RAW = 'node_modules/.cache/demo-raw';
const SIZE = { width: 1280, height: 720 };
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: RAW, size: SIZE } });
const page = await context.newPage();
const started = Date.now();

// Video does not show the pointer, so the page draws one that follows the mouse.
await page.addInitScript(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText =
      'position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(20,20,20,.55);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4);pointer-events:none;left:-40px;top:-40px;transition:transform .12s';
    document.body.append(dot);
    window.addEventListener('mousemove', (event) => {
      dot.style.left = `${event.clientX}px`;
      dot.style.top = `${event.clientY}px`;
    }, true);
    window.addEventListener('mousedown', () => (dot.style.transform = 'scale(.6)'), true);
    window.addEventListener('mouseup', () => (dot.style.transform = ''), true);
  });
});

const pause = (ms) => page.waitForTimeout(ms);
const idle = (timeout = 8000) => page.waitForFunction(() => window.mapIdle === true, null, { timeout }).catch(() => {});
/** Moves the pointer to an element, then clicks it. */
async function click(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
  await pause(150);
  await page.mouse.down();
  await pause(70);
  await page.mouse.up();
}
const preset = (name) => page.locator('.preset-card', { hasText: name });

await page.goto(URL);
await page.waitForFunction(() => window.mapIdle === true, null, { timeout: 60000 });
await pause(1200);
const trim = (Date.now() - started) / 1000 - 0.8;
await page.mouse.move(640, 360);
await pause(900);

// 1. Pick a preset.
await click(preset('Single Ink'));
await idle();
await pause(1500);

// 2. Change the primary colour: every part of the map follows.
const hex = page.getByLabel('Ink hex');
await click(hex);
await hex.press('ControlOrMeta+a');
await hex.pressSequentially('#0b6e4f', { delay: 90 });
await idle();
await pause(1700);

// 3. Switch presets: the primary carries over.
await click(preset('Colour Field'));
await idle();
await pause(1700);
await click(preset('Figure-Ground'));
await idle();
await pause(1500);

// 4. The zoom stops.
for (const stop of ['z4', 'z8', 'z12', 'z16']) {
  await click(page.locator('.zoom-bar .chip', { hasText: stop }));
  await pause(1300);
  await idle(2500);
  await pause(500);
}
await click(page.locator('.zoom-bar .chip', { hasText: 'z12' }));
await pause(1500);

// 5. Export.
await click(page.getByRole('button', { name: 'Export', exact: true }));
await pause(1400);
// Over the panel's edge, so the wheel scrolls the panel and not a text box.
await page.mouse.move(6, 420, { steps: 10 });
await page.mouse.wheel(0, 520);
await pause(1300);
await page.mouse.wheel(0, 620);
await pause(1800);

const length = (Date.now() - started) / 1000 - trim;
await context.close();
await browser.close();

const raw = join(RAW, readdirSync(RAW).find((file) => file.endsWith('.webm')));
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
// The page load before the first frame worth showing is cut off.
ffmpeg('-ss', trim.toFixed(2), '-i', raw, '-an', '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', `${OUT}/demo.mp4`);
ffmpeg('-ss', trim.toFixed(2), '-i', raw, '-vf', 'fps=8,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle', `${OUT}/demo.gif`);
console.log(`Recorded ${URL}: ${length.toFixed(1)} s (limit 30).`);
if (length >= 30) {
  console.error('The demo is 30 seconds or longer.');
  process.exit(1);
}
