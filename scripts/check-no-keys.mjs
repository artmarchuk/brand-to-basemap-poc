// Fails the build if a MapTiler key or MapTiler's style reached the bundle. The deployed app
// ships with neither: it fetches the style at runtime with the user's own key.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
const KEY_IN_URL = /[?&]key=[A-Za-z0-9]{16,}/;
const MAPTILER_STYLE = 'You are licensed to use the style or its derivate';

function personalKey() {
  if (process.env.MAPTILER_KEY) return process.env.MAPTILER_KEY;
  if (!existsSync('.env.local')) return undefined;
  return /^MAPTILER_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1].trim();
}

const key = personalKey();
const leaks = [];
for (const entry of readdirSync(DIST, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const path = join(entry.parentPath, entry.name);
  const content = readFileSync(path, 'latin1');
  if ((key && content.includes(key)) || KEY_IN_URL.test(content) || content.includes(MAPTILER_STYLE)) leaks.push(path);
}

if (leaks.length > 0) {
  // The key itself is never printed.
  console.error(`MapTiler key or style found in the bundle:\n  ${leaks.join('\n  ')}`);
  process.exit(1);
}
console.log(`No MapTiler key in ${DIST}/ (${key ? 'exact match and URL pattern' : 'URL pattern only, no local key'}).`);
