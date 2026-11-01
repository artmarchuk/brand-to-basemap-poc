// Writes the static harness into public/harness: plain page, vendored MapLibre, output styles
// for pinned base styles, and a small runtime for styles fetched with the user's key.
import { buildSync } from 'esbuild';
import type { StyleSpecification } from 'maplibre-gl';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { MAPPINGS } from '../src/mapping';
import { ALL_GROUPS } from '../src/mapping/types';
import { applyTokens } from '../src/style/applyTokens';
import type { TokenSet } from '../src/tokens/types';

const OUT = 'public/harness';
const MAPLIBRE = 'node_modules/maplibre-gl/dist';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/styles`, { recursive: true });
mkdirSync(`${OUT}/vendor`);
mkdirSync(`${OUT}/tokens`);
mkdirSync(`${OUT}/base`);

copyFileSync('harness/index.html', `${OUT}/index.html`);
for (const file of ['maplibre-gl.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) {
  copyFileSync(`${MAPLIBRE}/${file}`, `${OUT}/vendor/${file}`);
}

buildSync({
  entryPoints: ['harness/runtime.ts'],
  bundle: true,
  format: 'esm',
  outfile: `${OUT}/vendor/b2b-runtime.mjs`,
});

copyFileSync('fixtures/palettes.json', `${OUT}/palettes.json`);
// Liberty is pinned in the repo, so it ships. Streets is fetched at runtime.
copyFileSync('base-styles/liberty.json', `${OUT}/base/liberty.json`);

const SETS = ['neutral', 'brand', 'dark'];
for (const setId of SETS) copyFileSync(`harness/tokens/${setId}.json`, `${OUT}/tokens/${setId}.json`);

// Styles with a styleUrl are licensed: nothing derived from them is written here.
for (const [styleId, mapping] of Object.entries(MAPPINGS)) {
  if (mapping.provider.styleUrl) continue;
  const base = JSON.parse(readFileSync(`base-styles/${styleId}.json`, 'utf8')) as StyleSpecification;
  for (const setId of SETS) {
    const set = JSON.parse(readFileSync(`harness/tokens/${setId}.json`, 'utf8')) as TokenSet;
    const style = applyTokens(base, set.tokens, { mapping, groups: ALL_GROUPS, labelDensity: 'high' });
    writeFileSync(`${OUT}/styles/${styleId}--${setId}.json`, JSON.stringify(style));
  }
}
