// Screenshots of the real app with presets: each preset at z12 and z16 with default toggles, and the undo notice.
import { mkdirSync } from 'node:fs';
import { launchChrome, wait } from './lib-chrome.mjs';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = 'docs/screens/m3/app';
mkdirSync(OUT, { recursive: true });
const browser = await launchChrome({ port: 9390, width: 1440, height: 900 });
const click = (selector, nth = 0) => browser.evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${nth}].click()`);
await browser.open(URL, 1000);
await wait(10000);
const names = ['single-ink', 'figure-ground', 'colour-field'];
await click('input[name=preset]', 1); await wait(500);
// Edit a map colour first, so the switch has something to undo.
await browser.evaluate(`(() => { const i = document.querySelector('input[aria-label="Land colour"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '#eeeeee'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await wait(500);
await click('input[name=preset]', 0); await wait(1200);
await browser.screenshot(`${OUT}/undo-notice.png`);
console.log('undo notice:', await browser.evaluate(`document.querySelector('.notice')?.textContent`));
await click('.notice button'); await wait(800);
console.log('after undo preset:', await browser.evaluate(`document.querySelector('input[name=preset]:checked').closest('label').textContent`));
for (const [i, name] of names.entries()) {
  await click('input[name=preset]', i); await wait(7000);
  await browser.screenshot(`${OUT}/${name}-z12.png`);
  await click('.chip', 3); await wait(9000);
  await browser.screenshot(`${OUT}/${name}-z16.png`);
  await click('.chip', 2); await wait(3000);
  console.log(name, 'ok');
}
console.log(JSON.stringify(browser.session.problems.filter((p) => !/could not be loaded/.test(p)).slice(0, 6), null, 1));
browser.close();
