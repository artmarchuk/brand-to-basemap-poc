import { contrastRatio, makeColor, parseColor } from '../tokens/color';

const STEP = 0.005;

/**
 * Moves a colour in lightness, keeping hue and chroma where the gamut allows, until it reaches
 * `ratio` against every background. If it cannot, it ends at black or white.
 */
export function ensureContrast(
  css: string,
  backgrounds: string[],
  ratio: number,
  direction: 'darker' | 'lighter',
): string {
  const color = parseColor(css)!;
  let l = color.l;
  for (let step = 0; step <= 1 / STEP; step++) {
    const candidate = makeColor(l, color.c, color.h);
    if (backgrounds.every((background) => contrastRatio(candidate, background) >= ratio)) return candidate;
    l = Math.min(1, Math.max(0, l + (direction === 'darker' ? -STEP : STEP)));
  }
  return makeColor(direction === 'darker' ? 0 : 1, color.c, color.h);
}
