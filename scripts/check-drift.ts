// Compares the live provider styles with the mappings. Exits 1 if a mapping needs updating.
import type { StyleSpecification } from 'maplibre-gl';
import { existsSync, readFileSync } from 'node:fs';
import { MAPPINGS } from '../src/mapping';
import { detectDrift, hasDrift } from '../src/style/drift';
import { loadBaseStyle } from '../src/style/provider';

const key =
  process.env.MAPTILER_KEY ??
  (existsSync('.env.local') ? /^MAPTILER_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1].trim() : undefined);
const { tokens } = JSON.parse(readFileSync('harness/tokens/neutral.json', 'utf8'));

const readPin = (id: string): StyleSpecification | undefined =>
  existsSync(`base-styles/${id}.json`) ? JSON.parse(readFileSync(`base-styles/${id}.json`, 'utf8')) : undefined;

let drifted = false;
for (const [id, mapping] of Object.entries(MAPPINGS)) {
  const pinned = readPin(id);
  let live: StyleSpecification;
  if (mapping.provider.styleUrl) {
    if (!key) {
      console.log(`${id}: skipped, MAPTILER_KEY is not set`);
      continue;
    }
    live = await loadBaseStyle(mapping, key);
  } else {
    const source = (pinned!.metadata as Record<string, { source: string }>)['b2b:pin'].source;
    live = (await (await fetch(source)).json()) as StyleSpecification;
  }

  const report = detectDrift(live, mapping, tokens, pinned);
  drifted ||= hasDrift(report);
  console.log(`${id}: ${hasDrift(report) ? 'DRIFT' : 'ok'} (${live.layers.length} live layers, ${report.added.length} added and ${report.removed.length} removed against the local copy)`);
  for (const { code, message } of report.warnings) console.log(`  ${code}: ${message}`);
  for (const staleId of report.staleIds) console.log(`  stale-rule: "${staleId}" is no longer in the style`);
  for (const added of report.added) console.log(`  added: ${added}`);
  for (const removed of report.removed) console.log(`  removed: ${removed}`);
}
process.exit(drifted ? 1 : 0);
