// Checks that a layer group hidden at first is drawn once it is shown, on tiles that were already visited
// past the tiles' last zoom. The case that failed: Single Ink (no buildings) at z16, back to z12, switch to
// Figure-Ground, z16 again: no buildings. A MapLibre bug in 6.0.0 to 6.16.0, fixed in
// 6.17.0 (docs/upstream/maplibre-overzoom-cache.md); this guards against it coming back. Run against a served build:
//
//   npm run build && npx vite preview --port 4173 &   then   npm run check-reveal [url]
/* global window -- the functions passed to Playwright run in the page. */
import { chromium } from 'playwright-core';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL);

const settle = async () => {
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => window.mapIdle === true && window.b2bMap.areTilesLoaded() && !window.b2bMap.isMoving(), null, { timeout: 60000 });
  await page.waitForTimeout(800);
};
const buildings = () => page.evaluate(() => window.b2bMap.queryRenderedFeatures({ layers: ['building-3d'] }).length);
const preset = async (name) => {
  await page.locator('.preset-card', { hasText: name }).click();
  await settle();
};
const stop = async (name) => {
  await page.locator('.zoom-bar .chip', { hasText: name }).click();
  await settle();
};

await settle();
await preset('Single Ink');
await stop('z16');
const hidden = await buildings();
await stop('z12');
await preset('Figure-Ground');
await stop('z16');
const shown = await buildings();
await browser.close();

const checks = {
  [`Single Ink at z16 draws no buildings (${hidden})`]: hidden === 0,
  [`Figure-Ground at z16, on the tiles Single Ink visited, draws buildings (${shown})`]: shown > 10,
};
let failed = false;
for (const [name, pass] of Object.entries(checks)) {
  console.log(`${pass ? 'pass' : 'FAIL'}  ${name}`);
  if (!pass) failed = true;
}
process.exit(failed ? 1 : 0);
