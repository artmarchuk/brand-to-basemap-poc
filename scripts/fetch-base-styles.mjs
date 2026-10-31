// Refreshes the pinned base styles. The MapTiler key is stripped before anything is written.
import { readFileSync, writeFileSync } from 'node:fs';

const key =
  process.env.MAPTILER_KEY ?? /^MAPTILER_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1].trim();
if (!key) throw new Error('MAPTILER_KEY is not set');

const STYLES = {
  liberty: { provider: 'openfreemap', url: 'https://tiles.openfreemap.org/styles/liberty' },
  'streets-v2': { provider: 'maptiler', url: `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}` },
};

const fetchedAt = new Date().toISOString().slice(0, 10);
for (const [id, { provider, url }] of Object.entries(STYLES)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
  const stripped = (await response.text()).replaceAll(`?key=${key}`, '').replaceAll(`&key=${key}`, '').replaceAll(key, '');
  const style = JSON.parse(stripped);
  const source = url.replace(`?key=${key}`, '');
  style.metadata = { ...style.metadata, 'b2b:pin': { provider, source, fetchedAt } };
  writeFileSync(`base-styles/${id}.json`, `${JSON.stringify(style, null, 2)}\n`);
}
