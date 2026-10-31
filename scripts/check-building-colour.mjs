// Render check: in each z16 screenshot, a real share of pixels must be the exact building token.
// Lit 3D walls or a translucent layer would shift those pixels away from it.
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const STYLES = ['liberty', 'streets-v2'];
const SETS = ['neutral', 'brand', 'dark'];
const TOLERANCE = 2;
const MIN_SHARE = 0.05;

let failed = false;
for (const style of STYLES) {
  for (const set of SETS) {
    const { tokens } = JSON.parse(readFileSync(`harness/tokens/${set}.json`, 'utf8'));
    const target = [1, 3, 5].map((start) => parseInt(tokens.building.slice(start, start + 2), 16));
    const { data, width, height } = PNG.sync.read(readFileSync(`docs/screens/${style}-${set}-z16.png`));
    let matches = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (target.every((value, channel) => Math.abs(data[i + channel] - value) <= TOLERANCE)) matches++;
    }
    const share = matches / (width * height);
    const pass = share >= MIN_SHARE;
    failed ||= !pass;
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${style} ${set}: ${(share * 100).toFixed(1)}% of pixels are ${tokens.building}`);
  }
}
process.exit(failed ? 1 : 0);
