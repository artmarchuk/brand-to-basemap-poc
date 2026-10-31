import type { ColorRef, ColorSpec } from '../mapping/types';
import { formatColor, mixColors, parseColor, type Color } from '../tokens/color';
import type { ResolvedTokens, TokenName } from '../tokens/types';
import { collectColors, mapColors } from './expressions';

function tokenColor(tokens: ResolvedTokens, token: TokenName): Color {
  const color = parseColor(tokens[token]);
  if (!color) throw new Error(`Invalid colour for token ${token}: ${tokens[token]}`);
  return color;
}

export function resolveRef(ref: ColorRef, tokens: ResolvedTokens): Color {
  if (typeof ref === 'string') return tokenColor(tokens, ref);
  return mixColors(tokenColor(tokens, ref.token), tokenColor(tokens, ref.mix.with), ref.mix.amount);
}

function parseOriginal(css: string): Color {
  const color = parseColor(css);
  if (!color) throw new Error(`Unparsable colour in base style: ${css}`);
  return color;
}

/**
 * Lightness offset of each original colour from the last one, shifted so the whole ramp fits
 * inside 0-1 around the ref. Shifting rather than clamping keeps stops ordered and distinct.
 */
function rampOffsets(originals: Color[], baseLightness: number): number[] {
  const anchor = originals[originals.length - 1].l;
  const offsets = originals.map((color) => color.l - anchor);
  const overflow = Math.max(...offsets.map((offset) => baseLightness + offset)) - 1;
  const underflow = -Math.min(...offsets.map((offset) => baseLightness + offset));
  const shift = overflow > 0 ? -overflow : underflow > 0 ? underflow : 0;
  return offsets.map((offset) => offset + shift);
}

/** Rewrites a paint value: same structure, every colour replaced. Original alpha carries over. */
export function rewriteColors(value: unknown, spec: ColorSpec, tokens: ResolvedTokens): unknown {
  const originals = collectColors(value).map(parseOriginal);
  const explicit = typeof spec === 'object' && 'stops' in spec ? spec.stops : undefined;
  if (explicit && explicit.length !== originals.length) {
    throw new Error(`Expected ${originals.length} stops, got ${explicit.length}`);
  }

  const base = explicit ? undefined : resolveRef(spec as ColorRef, tokens);
  const offsets = base ? rampOffsets(originals, base.l) : [];

  let index = 0;
  return mapColors(value, () => {
    const i = index++;
    const color = explicit
      ? resolveRef(explicit[i], tokens)
      : { ...base!, l: Math.min(1, Math.max(0, base!.l + offsets[i])) };
    return formatColor({ ...color, alpha: originals[i].alpha });
  });
}
