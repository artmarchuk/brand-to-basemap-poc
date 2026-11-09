// Static preset thumbnails for the picker: each preset's sample palette in Zurich at z12, from the M3 captures.
// Crops the attribution strip off, then scales. macOS only (sips). Run after `npx tsx scripts/capture-m3.ts`.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

mkdirSync('public/thumbs', { recursive: true });
for (const id of ['single-ink', 'figure-ground', 'colour-field']) {
  const out = `public/thumbs/${id}.png`;
  execFileSync('sips', ['--cropToHeightWidth', '300', '400', '--cropOffset', '10', '120', `docs/screens/m3/raw/${id}-sample-zurich-z12.png`, '--out', out], { stdio: 'ignore' });
  execFileSync('sips', ['--resampleWidth', '240', out], { stdio: 'ignore' });
  console.log('thumb', out);
}
