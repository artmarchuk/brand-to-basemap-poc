// Writes docs/colour-vision.md: how far apart each preset's carrier pairs stay under the colour-vision
// simulations of the map preview. A report, not a check: nothing here feeds auto-fix.
//
//   npm run vision-report
import { readFileSync, writeFileSync } from 'node:fs';
import { createPresetState, PRESETS, resolvePreset, samplePresetState, type PresetDefinition, type PresetState } from '../src/presets';
import { colorDistance, contrastRatio } from '../src/tokens/color';
import type { ResolvedTokens, TokenName } from '../src/tokens/types';
import { simulate, SIMULATIONS, VISION_MODES, type VisionMode } from '../src/vision/simulate';

const fixtures = JSON.parse(readFileSync('fixtures/palettes.json', 'utf8')) as { name: string; colors: string[]; primary: number }[];

interface Pair {
  name: string;
  a: TokenName;
  b: TokenName;
  what: string;
}

/** The carrier pairs of each preset: the colours that have to stay apart for the map to read. */
const PAIRS: Record<string, Pair[]> = {
  'single-ink': [
    { name: 'Water vs land', a: 'water', b: 'land', what: 'ink water on paper' },
    { name: 'Major roads vs ground', a: 'roadMajor', b: 'land', what: 'ink roads on paper' },
  ],
  'figure-ground': [
    { name: 'Fabric vs water', a: 'urbanLanduse', b: 'water', what: 'the built-up city against the water' },
    { name: 'Water vs land', a: 'water', b: 'land', what: 'water on paper' },
    { name: 'Major roads vs ground', a: 'roadMajor', b: 'urbanLanduse', what: 'paper roads cut through the fabric' },
  ],
  'colour-field': [
    { name: 'Field vs deep', a: 'land', b: 'water', what: 'the land colour against the water' },
    { name: 'Major roads vs ground', a: 'roadMajor', b: 'land', what: 'roads on the field' },
  ],
};

interface Threshold {
  kind: 'distance' | 'contrast';
  min: number;
  /** The preset check it comes from, or undefined when the preset has no check for this pair. */
  check?: string;
}

/** The existing threshold for a pair: the preset's own check on those two tokens, else its carrier distance minimum. */
function thresholdFor(preset: PresetDefinition, pair: Pair): Threshold {
  const own = preset.checks.find(
    (check) => (check.subject === pair.a && check.against.includes(pair.b)) || (check.subject === pair.b && check.against.includes(pair.a)),
  );
  if (own) return { kind: own.kind, min: own.min, check: own.id };
  return { kind: 'distance', min: preset.checks.find((check) => check.kind === 'distance')!.min };
}

interface Cell {
  distance: number;
  contrast: number;
  below: boolean;
}

function measure(tokens: ResolvedTokens, pair: Pair, threshold: Threshold, mode: VisionMode): Cell {
  const [a, b] = [simulate(tokens[pair.a], mode), simulate(tokens[pair.b], mode)];
  // Rounded to three places, as the engine's own checks are, so a pair at exactly its threshold passes here too.
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const distance = round(colorDistance(a, b));
  const contrast = round(contrastRatio(a, b));
  return { distance, contrast, below: (threshold.kind === 'distance' ? distance : contrast) < threshold.min };
}

const format = (cell: Cell, threshold: Threshold) => {
  const text = threshold.kind === 'contrast' ? `${cell.distance.toFixed(3)} (${cell.contrast.toFixed(2)}:1)` : cell.distance.toFixed(3);
  return cell.below ? `**${text}**` : text;
};
const describeThreshold = (threshold: Threshold) =>
  `${threshold.kind === 'contrast' ? `${threshold.min}:1 contrast` : `${threshold.min} OKLab`}${threshold.check ? ` (“${threshold.check}”)` : ' (no check in the preset for this pair; its carrier minimum is used)'}`;

const lines: string[] = [];
const out = (...text: string[]) => lines.push(...text);

interface Collapse {
  preset: string;
  pair: string;
  palette: string;
  mode: VisionMode;
  cell: Cell;
  threshold: Threshold;
}
const collapses: Collapse[] = [];
const alreadyBelow: Collapse[] = [];
const sections: string[] = [];
const summary: string[] = ['| Preset | Pair | Threshold | Protanopia | Deuteranopia | Tritanopia | Achromatopsia |', '| --- | --- | --- | --- | --- | --- | --- |'];

for (const preset of PRESETS) {
  const inputs: [string, PresetState][] = [
    ['Sample palette', samplePresetState(preset.id)],
    ...fixtures.map((fixture): [string, PresetState] => [`${fixture.name} ${fixture.colors[fixture.primary].toLowerCase()}`, createPresetState(preset.id, fixture.colors[fixture.primary])]),
  ];
  const section: string[] = [`### ${preset.name}`, ''];
  for (const pair of PAIRS[preset.id]) {
    const threshold = thresholdFor(preset, pair);
    section.push(`**${pair.name}** (\`${pair.a}\` and \`${pair.b}\`: ${pair.what}). Threshold: ${describeThreshold(threshold)}.`, '');
    section.push('| Palette (primary) | None | Protanopia | Deuteranopia | Tritanopia | Achromatopsia |', '| --- | --- | --- | --- | --- | --- |');
    const below: Record<string, number> = {};
    for (const [name, state] of inputs) {
      const { tokens } = resolvePreset(state);
      const cells = VISION_MODES.map((mode) => measure(tokens, pair, threshold, mode));
      section.push(`| ${name} | ${cells.map((cell) => format(cell, threshold)).join(' | ')} |`);
      VISION_MODES.forEach((mode, index) => {
        if (!cells[index].below) return;
        const entry = { preset: preset.name, pair: pair.name, palette: name, mode, cell: cells[index], threshold };
        // Below the threshold with no simulation at all is not a colour-vision finding.
        if (mode === 'none' || cells[0].below) alreadyBelow.push(entry);
        else {
          collapses.push(entry);
          if (name !== 'Sample palette') below[mode] = (below[mode] ?? 0) + 1;
        }
      });
    }
    section.push('');
    summary.push(`| ${preset.name} | ${pair.name} | ${threshold.kind === 'contrast' ? `${threshold.min}:1` : threshold.min} | ${SIMULATIONS.map((mode) => (below[mode] ? `**${below[mode]} of ${fixtures.length}**` : `0 of ${fixtures.length}`)).join(' | ')} |`);
  }
  sections.push(...section);
}

out(
  '# Colour-vision report',
  '',
  'Generated by `npm run vision-report` ([scripts/generate-colour-vision-report.ts](../scripts/generate-colour-vision-report.ts)). Do not edit by hand.',
  '',
  'The map view has a **Colour vision** control: none, protanopia, deuteranopia, tritanopia, achromatopsia. It draws the map canvas through a colour-matrix filter, so a designer can see the map as someone with that colour vision would. It is a **preview only**: it changes nothing in the tokens, the state, the share link or the exports, and it adds no checks and no auto-fix rules. This report says what the preview will show: which carrier pairs stay apart under each simulation, and which collapse.',
  '',
  '## Method',
  '',
  '- **Simulation.** The same matrices as the preview filter ([src/vision/simulate.ts](../src/vision/simulate.ts)): Machado, Oliveira and Fernandes (2009) at severity 1.0 for protanopia, deuteranopia and tritanopia, and relative luminance for achromatopsia, all applied in linear RGB. The filter is an SVG `feColorMatrix` on the map canvas.',
  '- **Inputs.** Each preset in light mode, with its sample palette and with each of the 10 fixture palettes as the primary colour only ([fixtures/palettes.json](../fixtures/palettes.json)). The colours measured are the resolved tokens, after auto-fix.',
  '- **Carrier pairs.** The colours that carry each preset: water against land, fabric against water, field against deep, and major roads against the ground they are drawn on.',
  '- **Measure.** OKLab distance between the two simulated colours (about 0.02 is a just-noticeable difference). Road pairs also show the WCAG contrast ratio, because that is what their existing check uses.',
  '- **Thresholds.** The existing ones from the preset files, unchanged: the preset\'s own check for that pair (0.12 OKLab for carriers, a contrast ratio for roads). A value below its threshold is **bold**. A pair **collapses** when it passes with no simulation and falls below under one.',
  '',
  '## Summary',
  '',
  'Fixture palettes, of 10, in which the pair collapses under each simulation:',
  '',
  ...summary,
  '',
);

const byPreset = (list: Collapse[]) =>
  PRESETS.flatMap((preset) => {
    const own = list.filter((entry) => entry.preset === preset.name);
    if (own.length === 0) return [];
    const pairs = [...new Set(own.map((entry) => entry.pair))];
    return [
      `**${preset.name}**`,
      '',
      ...pairs.flatMap((pair) => {
        const palettes = [...new Set(own.filter((entry) => entry.pair === pair).map((entry) => entry.palette))];
        return palettes.map((palette) => {
          const hits = own.filter((entry) => entry.pair === pair && entry.palette === palette);
          const { threshold } = hits[0];
          const value = (entry: Collapse) => (threshold.kind === 'contrast' ? `${entry.cell.contrast.toFixed(2)}:1` : entry.cell.distance.toFixed(3));
          return `- ${pair}, ${palette}: ${hits.map((entry) => `${entry.mode} ${value(entry)}`).join(', ')} (needs ${threshold.kind === 'contrast' ? `${threshold.min}:1` : threshold.min}).`;
        });
      }),
      '',
    ];
  });

out('## Pairs that collapse', '');
if (collapses.length === 0) out('None: every pair that passes with no simulation also passes under all four.', '');
else out('These pass with no simulation and fall below their existing threshold under the simulation named.', '', ...byPreset(collapses));

if (alreadyBelow.length > 0) {
  out(
    '### Already below with no simulation',
    '',
    'Not colour-vision findings: these pairs are under the threshold in the plain map too, so they are listed apart.',
    '',
    ...byPreset(alreadyBelow.filter((entry) => entry.mode === 'none')),
  );
}

out('## Every pair, palette and simulation', '', 'OKLab distance; road pairs add the contrast ratio. Bold is below the threshold.', '', ...sections);

out(
  '## What this does not cover',
  '',
  '- **Light mode only.** Data mode lowers chroma on purpose, so pairs sit closer at high recede under every simulation.',
  '- **Primary only.** Typed slots and overrides can move any pair either way.',
  '- **Labels are not in the table.** Label checks are contrast ratios, which are close to luminance and change little under the dichromacy matrices; the preview shows them.',
  '- **A simulation is a model.** Machado et al. model dichromacy, the full loss of one cone type. Most people with a colour-vision deficiency have a milder, anomalous form and see more separation than this.',
  '- **No auto-fix.** Nothing is adjusted for these findings in P0. A designer who sees a collapse in the preview can type a different slot colour.',
  '',
);

writeFileSync('docs/colour-vision.md', lines.join('\n'));
console.log(`docs/colour-vision.md: ${collapses.length} collapsing cells, ${alreadyBelow.filter((entry) => entry.mode === 'none').length} already below with no simulation.`);
