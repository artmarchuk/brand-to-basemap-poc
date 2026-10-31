// Captures the harness matrix through headless Chrome. The key is injected into the page's
// localStorage over the debugging protocol, so it reaches neither a URL nor a screenshot.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.argv[2] ?? 'http://localhost:4173/harness/index.html';
const OUT = 'docs/screens';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9334;
const STYLES = ['liberty', 'streets-v2'];
const SETS = ['neutral', 'brand', 'dark'];
const ZOOMS = [4, 8, 12, 16];
const IDLE_TIMEOUT_MS = 45000;

const key =
  process.env.MAPTILER_KEY ??
  (existsSync('.env.local') ? /^MAPTILER_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1].trim() : undefined);
if (!key) throw new Error('MAPTILER_KEY is not set');

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const chrome = spawn(CHROME, [
  '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${resolve('node_modules/.cache/capture-chrome')}`,
  '--window-size=1024,700', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

let target;
for (let attempt = 0; attempt < 60 && !target; attempt++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    target = targets.find((candidate) => candidate.type === 'page');
  } catch {
    await wait(250);
  }
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((done) => { socket.onopen = done; });

let nextId = 0;
const pending = new Map();
let problems = [];
const send = (method, params = {}, sessionId) =>
  new Promise((done) => {
    const id = ++nextId;
    pending.set(id, done);
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message.result ?? message);
    pending.delete(message.id);
  } else if (message.method === 'Target.attachedToTarget') {
    const { sessionId } = message.params;
    send('Runtime.enable', {}, sessionId);
    send('Runtime.runIfWaitingForDebugger', {}, sessionId);
  } else if (message.method === 'Runtime.exceptionThrown') {
    problems.push(`exception: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
  } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
    problems.push(`${message.params.type}: ${message.params.args.map((arg) => arg.value ?? arg.description).join(' ')}`);
  }
};

for (const domain of ['Page', 'Runtime']) await send(`${domain}.enable`);
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { localStorage.setItem('b2b:maptilerKey', ${JSON.stringify(key)}); } catch {}`,
});

async function idle() {
  const deadline = Date.now() + IDLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { result } = await send('Runtime.evaluate', { expression: 'window.mapIdle === true' });
    if (result.value) return true;
    await wait(250);
  }
  return false;
}

async function screenshot(path) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(data, 'base64'));
}

mkdirSync(OUT, { recursive: true });
const failures = new Set();
// Both base styles request POI icons their sprites lack. It comes from tile data, not our output.
const MISSING_ICON = /^warning: Image ".*" could not be loaded/;
let missingIcons = 0;
for (const style of STYLES) {
  for (const set of SETS) {
    for (const zoom of ZOOMS) {
      problems = [];
      await send('Page.navigate', { url: 'about:blank' });
      await send('Page.navigate', { url: `${BASE_URL}#${new URLSearchParams({ style, set, zoom, shot: 1 })}` });
      await wait(500);
      const ready = await idle();
      await wait(300);
      await screenshot(`${OUT}/${style}-${set}-z${zoom}.png`);
      console.log(`${ready ? 'ok     ' : 'TIMEOUT'} ${style} ${set} z${zoom}`);
      if (!ready) failures.add(`${style} ${set} z${zoom}: did not reach idle`);
      for (const problem of problems) {
        if (MISSING_ICON.test(problem)) missingIcons++;
        else failures.add(problem.replaceAll(key, '<key>'));
      }
    }
  }
}

// One overview sheet per style, for review without opening 24 files.
await send('Emulation.setDeviceMetricsOverride', { width: 2048, height: 1060, deviceScaleFactor: 1, mobile: false });
for (const style of STYLES) {
  const rows = SETS.flatMap((set) =>
    ZOOMS.map((zoom) => `<figure><img src="file://${resolve(OUT)}/${style}-${set}-z${zoom}.png"><figcaption>${set} z${zoom}</figcaption></figure>`),
  );
  const sheet = resolve('node_modules/.cache/capture-sheet.html');
  writeFileSync(sheet, `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; background: #222; font: 13px system-ui; color: #fff; }
    figure { margin: 0; } img { width: 100%; display: block; } figcaption { padding: 2px 6px; }
  </style>${rows.join('')}`);
  await send('Page.navigate', { url: `file://${sheet}` });
  await wait(1500);
  await screenshot(`${OUT}/overview-${style}.png`);
}

console.log(`\n${missingIcons} missing-icon fallbacks (present in the base style).`);
console.log(failures.size ? `\nProblems:\n${[...failures].join('\n')}` : '\nNo console warnings or errors.');
chrome.kill();
process.exit(failures.size ? 1 : 0);
