import type { StyleSpecification } from 'maplibre-gl';
import { readFileSync, writeFileSync } from 'node:fs';
import { MAPPINGS } from '../src/mapping';
import { buildReport, reportMarkdown } from '../src/style/report';

for (const [id, mapping] of Object.entries(MAPPINGS)) {
  const style = JSON.parse(readFileSync(`base-styles/${id}.json`, 'utf8')) as StyleSpecification;
  const rows = buildReport(style, mapping);
  writeFileSync(`docs/reports/unmapped-${id}.md`, reportMarkdown(rows, mapping));
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  console.log(`${id}: ${rows.length} layers, ${count('mapped')} mapped, ${count('derived')} derived, ${count('hidden')} hidden`);
}
