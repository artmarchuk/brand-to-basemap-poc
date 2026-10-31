import type { StyleSpecification } from 'maplibre-gl';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { MAPPINGS } from '../src/mapping';
import { buildReport, reportMarkdown } from '../src/style/report';

for (const [id, mapping] of Object.entries(MAPPINGS)) {
  const path = `base-styles/${id}.json`;
  if (!existsSync(path)) {
    console.warn(`Skipping ${id}: run npm run fetch-styles first.`);
    continue;
  }
  const style = JSON.parse(readFileSync(path, 'utf8')) as StyleSpecification;
  const rows = buildReport(style, mapping);
  writeFileSync(`docs/reports/unmapped-${id}.md`, reportMarkdown(rows, mapping));
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  console.log(`${id}: ${rows.length} layers, ${count('mapped')} mapped, ${count('derived')} derived, ${count('hidden')} hidden`);
}
