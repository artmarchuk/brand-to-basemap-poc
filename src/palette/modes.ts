import type { LabelDensity, ToggleGroup } from '../mapping/types';
import { makeColor, parseColor } from '../tokens/color';
import type { Mode, ResolvedTokens, TokenName } from '../tokens/types';
import { PALETTE_CONFIG, type PaletteConfig } from './config';
import { ensureContrast } from './contrast';
import { enforceRoadGap } from './roadGap';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface VisibilityHints {
  hidePois: boolean;
  thinMinorLabels: boolean;
}

export const NO_HINTS: VisibilityHints = { hidePois: false, thinMinorLabels: false };

/** Applies the hints to the toggle state the map would otherwise use. */
export function applyVisibility(
  groups: ToggleGroup[],
  labelDensity: LabelDensity,
  hints: VisibilityHints,
): { groups: ToggleGroup[]; labelDensity: LabelDensity } {
  return {
    groups: hints.hidePois ? groups.filter((group) => group !== 'pois') : groups,
    labelDensity: hints.thinMinorLabels ? 'low' : labelDensity,
  };
}

export function transformDark(light: ResolvedTokens, config: PaletteConfig = PALETTE_CONFIG): ResolvedTokens {
  const { dark: D, minHueChroma } = config;
  const read = (token: TokenName) => parseColor(light[token])!;
  const hasHue = (token: TokenName) => read(token).c >= minHueChroma;

  const land = makeColor(D.land.l, clamp(read('land').c * D.land.cScale, 0, D.land.cMax), read('land').h);
  const water = makeColor(D.water.l, clamp(read('water').c * D.water.cScale, D.water.cMin, D.water.cMax), read('water').h);
  const park = makeColor(D.park.l, clamp(read('park').c * D.park.cScale, D.park.cMin, D.park.cMax), read('park').h);
  const building = makeColor(
    D.land.l + D.building.lOffsetFromLand,
    clamp(read('building').c * D.building.cScale, 0, D.building.cMax),
    read('building').h,
  );

  // Floors apply only to a brand that has a hue, so grey brands stay grey.
  const floor = (token: TokenName, cMin: number) => (hasHue(token) ? cMin : 0);
  const major = read('roadMajor');
  const minor = read('roadMinor');
  const roadMajor = makeColor(D.roadMajor.l, Math.max(floor('roadMajor', D.roadMajor.cMin), major.c * D.roadMajor.cScale), major.h);
  const roadMinor = makeColor(D.roadMinor.l, minor.c * D.roadMinor.cScale, minor.h);

  const surfaces = [land, water, park, building];
  const label = (token: 'labelPrimary' | 'labelSecondary') =>
    ensureContrast(makeColor(D[token].l, read(token).c, read(token).h), surfaces, D[token].contrast, 'lighter');

  const accent = read('accent');
  const accentHex = makeColor(Math.max(D.accent.lMin, accent.l), Math.max(floor('accent', D.accent.cMin), accent.c), accent.h);
  const landColor = parseColor(land)!;

  return enforceRoadGap(config.minRoadLightnessGap)({
    land,
    water,
    park,
    roadMajor,
    roadMinor,
    building,
    boundary: makeColor(D.boundary.l, read('boundary').c * D.boundary.cScale, read('boundary').h),
    labelPrimary: label('labelPrimary'),
    labelSecondary: label('labelSecondary'),
    halo: makeColor(landColor.l + D.halo.lOffsetFromLand, landColor.c, landColor.h),
    accent: ensureContrast(accentHex, [land], D.accent.contrast, 'lighter'),
  });
}

const SURFACES: TokenName[] = ['land', 'water', 'park', 'building'];
const RECEDING_FILLS: TokenName[] = [...SURFACES, 'roadMajor', 'roadMinor'];

/**
 * Recede scales chroma on fills and lines, and pulls their lightness towards the mean of the
 * surfaces so nothing shouts. Labels, halo and accent are untouched, so surfaces may only get
 * lighter: darker surfaces would cost the labels and the accent their contrast.
 * Recede 0 returns the input itself.
 */
export function transformData(light: ResolvedTokens, recede: number, config: PaletteConfig = PALETTE_CONFIG): ResolvedTokens {
  const t = clamp(recede, 0, 100) / 100;
  if (t === 0) return light;

  const { minChromaShare, lightnessPull } = config.data;
  const chromaFactor = 1 - (1 - minChromaShare) * t;
  const fills = RECEDING_FILLS.map((token) => parseColor(light[token])!);
  const surfaceLightness = SURFACES.map((token) => parseColor(light[token])!.l);
  const meanLightness = surfaceLightness.reduce((sum, l) => sum + l, 0) / surfaceLightness.length;

  const output = { ...light };
  RECEDING_FILLS.forEach((token, index) => {
    const color = fills[index];
    const pulled = color.l + (meanLightness - color.l) * lightnessPull * t;
    const lightness = SURFACES.includes(token) ? Math.max(color.l, pulled) : pulled;
    output[token] = makeColor(lightness, color.c * chromaFactor, color.h);
  });
  const boundary = parseColor(light.boundary)!;
  output.boundary = makeColor(boundary.l, boundary.c * chromaFactor, boundary.h);
  return output;
}

export function dataVisibility(recede: number, config: PaletteConfig = PALETTE_CONFIG): VisibilityHints {
  return { hidePois: recede > config.data.hidePoisAbove, thinMinorLabels: recede > config.data.thinLabelsAbove };
}

export interface ModeOptions {
  recede?: number;
  config?: PaletteConfig;
}

/** Takes the base (light) tokens. Data mode expects the light set after light overrides. */
export function transformForMode(
  light: ResolvedTokens,
  mode: Mode,
  { recede = 0, config = PALETTE_CONFIG }: ModeOptions = {},
): { tokens: ResolvedTokens; visibility: VisibilityHints } {
  if (mode === 'dark') return { tokens: transformDark(light, config), visibility: NO_HINTS };
  if (mode === 'data') return { tokens: transformData(light, recede, config), visibility: dataVisibility(recede, config) };
  return { tokens: light, visibility: NO_HINTS };
}
