// Screenshots of the real app in headless Chrome: each step drives the UI through the DOM.
import { mkdirSync } from 'node:fs';
import { launchChrome, wait } from './lib-chrome.mjs';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = 'docs/screens/s2';
mkdirSync(OUT, { recursive: true });
const browser = await launchChrome({ port: 9336, width: 1440, height: 900 });
const click = (selector, nth = 0) => browser.evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${nth}].click()`);
const focusSlider = () => browser.evaluate(`document.querySelector('[role=slider]').focus()`);
const settle = async (ms = 9000) => { await wait(ms); };

await browser.open(URL, 1000);
await settle(12000);
await browser.screenshot(`${OUT}/01-light.png`);

await click('input[name=mode]', 1); await settle();
await browser.screenshot(`${OUT}/02-dark.png`);

await click('input[name=mode]', 2); await settle();
await browser.screenshot(`${OUT}/03-data.png`);

// Recede 100 via keyboard on the slider.
await focusSlider();
await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
await settle();
await browser.screenshot(`${OUT}/04-data-recede-100.png`);

await click('input[name=mode]', 0);
await click('.chip', 3); await settle(8000);
await browser.screenshot(`${OUT}/05-light-z16.png`);

console.log(JSON.stringify(browser.session.problems.slice(0, 8), null, 1));
browser.close();
