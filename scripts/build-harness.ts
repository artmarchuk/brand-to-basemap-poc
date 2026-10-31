// Writes the static harness into public/harness: plain page, vendored MapLibre, output styles.
import type { StyleSpecification } from 'maplibre-gl';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { MAPPINGS } from '../src/mapping';
import type { ToggleGroup } from '../src/mapping/types';
import { applyTokens } from '../src/style/applyTokens';
import type { TokenSet } from '../src/tokens/types';

// Everything on, so every mapped layer can be inspected.
const ALL_GROUPS: ToggleGroup[] = ['core', 'pois', 'transit', 'buildings', 'landuse', 'minorRoads', 'boundaries', 'labels'];
const OUT = 'public/harness';
const MAPLIBRE = 'node_modules/maplibre-gl/dist';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/styles`, { recursive: true });
mkdirSync(`${OUT}/vendor`);

copyFileSync('harness/index.html', `${OUT}/index.html`);
for (const file of ['maplibre-gl.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) {
  copyFileSync(`${MAPLIBRE}/${file}`, `${OUT}/vendor/${file}`);
}

for (const [styleId, mapping] of Object.entries(MAPPINGS)) {
  const base = JSON.parse(readFileSync(`base-styles/${styleId}.json`, 'utf8')) as StyleSpecification;
  for (const setId of ['neutral', 'brand', 'dark']) {
    const set = JSON.parse(readFileSync(`harness/tokens/${setId}.json`, 'utf8')) as TokenSet;
    const style = applyTokens(base, set.tokens, { mapping, groups: ALL_GROUPS, labelDensity: 'high' });
    writeFileSync(`${OUT}/styles/${styleId}--${setId}.json`, JSON.stringify(style));
  }
}
