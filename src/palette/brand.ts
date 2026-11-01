import { parseColor, type Color } from '../tokens/color';
import { PaletteError } from './errors';

export interface BrandInput {
  /** 2 to 5 hex colours. */
  colors: string[];
  /** Index of the primary colour in `colors`. */
  primary: number;
}

export const MIN_COLORS = 2;
export const MAX_COLORS = 5;

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(value: unknown): string {
  if (typeof value !== 'string' || !HEX.test(value.trim())) {
    throw new PaletteError('invalid-hex', `Not a hex colour: ${JSON.stringify(value)}`);
  }
  let digits = value.trim().replace('#', '').toLowerCase();
  if (digits.length === 3) digits = [...digits].map((digit) => digit + digit).join('');
  return `#${digits}`;
}

export interface Brand {
  hexes: string[];
  colors: Color[];
  primary: Color;
  primaryIndex: number;
}

/** Validates brand input and reads it into OKLCH. Throws PaletteError, never anything else. */
export function readBrand(input: BrandInput): Brand {
  if (!input || !Array.isArray(input.colors)) throw new PaletteError('too-few-colors', 'Brand needs a list of colours');
  if (input.colors.length < MIN_COLORS) throw new PaletteError('too-few-colors', `Use at least ${MIN_COLORS} colours`);
  if (input.colors.length > MAX_COLORS) throw new PaletteError('too-many-colors', `Use at most ${MAX_COLORS} colours`);
  if (!Number.isInteger(input.primary) || input.primary < 0 || input.primary >= input.colors.length) {
    throw new PaletteError('invalid-primary', `Primary must be an index from 0 to ${input.colors.length - 1}`);
  }
  const hexes = input.colors.map(normalizeHex);
  const colors = hexes.map((hex) => parseColor(hex)!);
  return { hexes, colors, primary: colors[input.primary], primaryIndex: input.primary };
}
