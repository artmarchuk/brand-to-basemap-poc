// The only file that knows about culori, so the colour library can change.
import { clampChroma, converter, formatHex, formatRgb, interpolate, parse } from 'culori';

export interface Color {
  l: number;
  c: number;
  h: number;
  alpha: number;
}

const toOklch = converter('oklch');

export function parseColor(css: string): Color | undefined {
  const parsed = parse(css);
  if (!parsed) return undefined;
  const { l, c, h, alpha } = toOklch(parsed);
  return { l, c, h: h ?? 0, alpha: alpha ?? 1 };
}

export function mixColors(from: Color, to: Color, amount: number): Color {
  const mixed = interpolate([{ mode: 'oklch' as const, ...from }, { mode: 'oklch' as const, ...to }], 'oklch')(amount);
  return { l: mixed.l, c: mixed.c, h: mixed.h ?? 0, alpha: from.alpha };
}

/** Hex when opaque, rgba() when not. Out-of-gamut colours are pulled in by chroma. */
export function formatColor(color: Color): string {
  const inGamut = clampChroma({ mode: 'oklch', l: color.l, c: color.c, h: color.h }, 'oklch', 'rgb');
  if (color.alpha >= 1) return formatHex(inGamut);
  return formatRgb({ ...inGamut, alpha: Math.round(color.alpha * 1000) / 1000 });
}

/** Canonical RGB form, used to compare colours regardless of how they were written. */
export function rgbKey(css: string): string | undefined {
  const parsed = parse(css);
  return parsed ? formatHex(parsed) : undefined;
}

export function lightnessOf(css: string): number {
  const color = parseColor(css);
  if (!color) throw new Error(`Invalid colour: ${css}`);
  return color.l;
}

/** Same hue, same or lower chroma if the new lightness needs it, as opaque hex. */
export function withLightness(css: string, lightness: number): string {
  const color = parseColor(css);
  if (!color) throw new Error(`Invalid colour: ${css}`);
  return formatColor({ ...color, l: lightness, alpha: 1 });
}
