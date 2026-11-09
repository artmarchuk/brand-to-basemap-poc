// The preset panel with exposed slots up front and Refine collapsed or open.
import { mkdirSync } from 'node:fs';
import { launchChrome, wait } from './lib-chrome.mjs';
const URL = process.argv[2] ?? 'http://localhost:5179/';
const OUT = 'docs/screens/m3/app';
mkdirSync(OUT, { recursive: true });
const b = await launchChrome({ port: 9397, width: 1100, height: 760 });
await b.open(URL, 1000);
await wait(8000);
const click = (sel, n = 0) => b.evaluate(`document.querySelectorAll(${JSON.stringify(sel)})[${n}].click()`);
for (const [i, name] of ['single-ink', 'figure-ground', 'colour-field'].entries()) {
  await click('input[name=preset]', i); await wait(2500);
  await b.screenshot(`${OUT}/slots-${name}.png`);
}
await b.evaluate(`document.querySelector('.refine').open = true`); await wait(800);
await b.screenshot(`${OUT}/slots-colour-field-refine-open.png`);
console.log(await b.evaluate(`[...document.querySelectorAll('.preset-grid ~ h3, .preset-grid ~ ul .token-name, .refine summary')].map((e) => e.textContent.trim().replace(/\\s+/g, ' '))`));
b.close();
