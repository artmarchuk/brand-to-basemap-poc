// Refreshes the local base styles. Liberty is pinned in the repo. Streets v2 is gitignored,
// because its licence limits it to use with MapTiler, and the key is stripped before writing.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const key =
  process.env.MAPTILER_KEY ??
  (existsSync('.env.local') ? /^MAPTILER_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1].trim() : undefined);

const STYLES = {
  liberty: { provider: 'openfreemap', source: 'https://tiles.openfreemap.org/styles/liberty' },
  'streets-v2': { provider: 'maptiler', source: 'https://api.maptiler.com/maps/streets-v2/style.json', needsKey: true },
};

const fetchedAt = new Date().toISOString().slice(0, 10);
for (const [id, { provider, source, needsKey }] of Object.entries(STYLES)) {
  if (needsKey && !key) {
    console.warn(`Skipping ${id}: MAPTILER_KEY is not set.`);
    continue;
  }
  const response = await fetch(needsKey ? `${source}?key=${key}` : source);
  if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
  const text = await response.text();
  const stripped = needsKey ? text.replaceAll(`?key=${key}`, '').replaceAll(`&key=${key}`, '').replaceAll(key, '') : text;
  const style = JSON.parse(stripped);
  style.metadata = { ...style.metadata, 'b2b:pin': { provider, source, fetchedAt } };
  writeFileSync(`base-styles/${id}.json`, `${JSON.stringify(style, null, 2)}\n`);
}
