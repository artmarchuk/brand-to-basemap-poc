// Screenshots of the real app with presets: each preset at z12 and z16 with default toggles.
// It also checks that an edited map colour survives a preset switch and back (the M4 persistence rule;
// the one-step undo notice this script used to capture was removed in M4).
import { mkdirSync } from 'node:fs';
import { launchChrome, wait } from './lib-chrome.mjs';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = 'docs/screens/m3/app';
mkdirSync(OUT, { recursive: true });
const browser = await launchChrome({ port: 9390, width: 1440, height: 900 });
const click = (selector, nth = 0) => browser.evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${nth}].click()`);
const landColour = () => browser.evaluate(`document.querySelector('input[aria-label="Land colour"]').value`);
// Start from the defaults: no autosave from an earlier run, no hash.
await browser.open(URL, 1000);
await browser.evaluate(`localStorage.removeItem('b2b:state')`);
await browser.open(URL, 1000);
await wait(10000);
const names = ['single-ink', 'figure-ground', 'colour-field'];

// Edit a map colour in Figure-Ground, switch away and back: the edit must still be there.
await click('input[name=preset]', 1); await wait(500);
await browser.evaluate(`(() => { const i = document.querySelector('input[aria-label="Land colour"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '#eeeeee'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await wait(500);
await click('input[name=preset]', 0); await wait(1200);
await click('input[name=preset]', 1); await wait(1200);
const kept = await landColour();
console.log('land edit after switching away and back:', kept);
if (kept !== '#eeeeee') {
  console.error('The edited colour was lost on a preset switch.');
  process.exitCode = 1;
}
await click('button[aria-label="Reset Land to derived"]'); await wait(500);

// A fixed wait is not enough at z16 in software rendering: wait until the map reports it has drawn everything.
const settled = async (timeoutMs = 60000) => {
  await wait(2500);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !(await browser.evaluate('window.mapIdle === true && window.b2bMap.areTilesLoaded() && !window.b2bMap.isMoving()'))) await wait(300);
  await wait(1500);
};
for (const [i, name] of names.entries()) {
  await click('input[name=preset]', i); await settled();
  await browser.screenshot(`${OUT}/${name}-z12.png`);
  await click('.chip', 3); await settled();
  await browser.screenshot(`${OUT}/${name}-z16.png`);
  await click('.chip', 2); await wait(3000);
  console.log(name, 'ok');
}
const problems = browser.session.problems.filter((p) => !/could not be loaded/.test(p));
console.log(JSON.stringify(problems.slice(0, 6), null, 1));
browser.close();
