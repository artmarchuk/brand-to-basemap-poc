// Headless Chrome over the DevTools protocol, shared by the screenshot scripts.
// Pages get the MapTiler key in localStorage through the protocol, so it never reaches a URL or image.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
export { wait };

export async function launchChrome({ port, key, width = 1024, height = 700 }) {
  const chrome = spawn(CHROME, [
    '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(`node_modules/.cache/capture-chrome-${port}`)}`,
    `--window-size=${width},${height}`, '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });

  let target;
  for (let attempt = 0; attempt < 60 && !target; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = targets.find((candidate) => candidate.type === 'page');
    } catch {
      await wait(250);
    }
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done) => { socket.onopen = done; });

  let nextId = 0;
  const pending = new Map();
  const session = { problems: [] };
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
      send('Runtime.enable', {}, message.params.sessionId);
      send('Runtime.runIfWaitingForDebugger', {}, message.params.sessionId);
    } else if (message.method === 'Runtime.exceptionThrown') {
      session.problems.push(`exception: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
    } else if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      session.problems.push(`${message.params.type}: ${message.params.args.map((arg) => arg.value ?? arg.description).join(' ')}`);
    }
  };
  for (const domain of ['Page', 'Runtime']) await send(`${domain}.enable`);
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  if (key) {
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { localStorage.setItem('b2b:maptilerKey', ${JSON.stringify(key)}); } catch {}`,
    });
  }

  return {
    session,
    send,
    evaluate: async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value,
    async open(url, timeoutMs = 45000) {
      session.problems = [];
      await send('Page.navigate', { url: 'about:blank' });
      await send('Page.navigate', { url });
      await wait(500);
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if ((await send('Runtime.evaluate', { expression: 'window.mapIdle === true' })).result?.value) {
          await wait(300);
          return true;
        }
        await wait(250);
      }
      return false;
    },
    async screenshot(path) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path, Buffer.from(data, 'base64'));
    },
    close() {
      chrome.kill();
    },
  };
}
