import type { TokenName } from '../tokens/types';
import type { ColorRef } from './types';

export function tint(token: TokenName, towards: TokenName, amount: number): ColorRef {
  return { token, mix: { with: towards, amount } };
}

export const text = (color: ColorRef) => ({ 'text-color': color, 'text-halo-color': 'halo' as const });

// Derived colours mix towards other tokens rather than a fixed lighter or darker offset, so
// a casing stays visible whether the set is light or dark: labelPrimary always contrasts.
export const casing = (road: TokenName) => tint(road, 'labelPrimary', 0.25);
export const tunnel = (road: TokenName) => tint(road, 'land', 0.35);
export const rail = tint('land', 'labelSecondary', 0.45);
export const waterLabel = tint('water', 'labelPrimary', 0.6);
