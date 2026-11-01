import { makeColor, parseColor, type Color } from '../tokens/color';
import type { ResolvedTokens } from '../tokens/types';
import { readBrand, type Brand, type BrandInput } from './brand';
import { PALETTE_CONFIG, type PaletteConfig } from './config';
import { ensureContrast } from './contrast';
import { enforceRoadGap } from './roadGap';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrapHue = (hue: number) => ((hue % 360) + 360) % 360;
/** Signed shortest turn from one hue to another, in degrees. */
export const hueDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

interface Anchor {
  hue: number;
  /** Chroma of the brand colour the hue came from, when it snapped to one. */
  chroma?: number;
}

/**
 * Water and park must read as water and park. A brand colour near the natural hue lends its hue;
 * otherwise the natural hue moves a little way towards the brand's.
 */
function anchoredHue(
  chromatic: Color[],
  tintHue: number | undefined,
  spec: { hue: number; snapRange: number; pull: number; maxPullDegrees: number },
): Anchor {
  const nearest = [...chromatic].sort(
    (a, b) => Math.abs(hueDelta(spec.hue, a.h)) - Math.abs(hueDelta(spec.hue, b.h)),
  )[0];
  if (nearest && Math.abs(hueDelta(spec.hue, nearest.h)) <= spec.snapRange) return { hue: nearest.h, chroma: nearest.c };
  if (tintHue === undefined) return { hue: spec.hue };
  const pull = clamp(hueDelta(spec.hue, tintHue) * spec.pull, -spec.maxPullDegrees, spec.maxPullDegrees);
  return { hue: wrapHue(spec.hue + pull) };
}

function areaChroma(anchor: Anchor, { cMin, cMax }: { cMin: number; cMax: number }) {
  return clamp(anchor.chroma ?? (cMin + cMax) / 2, cMin, cMax);
}

/** Base tokens for the light map, from 2-5 brand colours. Pure and deterministic. */
export function deriveTokens(input: BrandInput, config: PaletteConfig = PALETTE_CONFIG): ResolvedTokens {
  const brand: Brand = readBrand(input);
  const { light: L } = config;
  const chromatic = brand.colors.filter((color) => color.c >= config.minHueChroma);
  const byChroma = [...chromatic].sort((a, b) => b.c - a.c);

  // The tint source: the primary when it has a hue, else the most chromatic colour, else none.
  const tintSource = brand.primary.c >= config.minHueChroma ? brand.primary : byChroma[0];
  const tintHue = tintSource?.h;
  const tintChroma = tintSource?.c ?? 0;
  const hue = tintHue ?? config.neutralHue;
  const tinted = (share: number, cMax: number) => Math.min(cMax, tintChroma * share);

  const water = anchoredHue(chromatic, tintHue, config.water);
  const park = anchoredHue(chromatic, tintHue, config.park);

  const land = makeColor(L.land.l, tinted(L.land.tint, L.land.cMax), hue);
  const landColor = parseColor(land)!;
  const waterHex = makeColor(L.water.l, areaChroma(water, L.water), water.hue);
  const parkHex = makeColor(L.park.l, areaChroma(park, L.park), park.hue);
  const building = makeColor(L.land.l + L.building.lOffsetFromLand, tinted(L.building.tint, L.building.cMax), hue);

  const roadSource = tintSource ?? brand.primary;
  const majorChroma = tintSource ? clamp(roadSource.c, L.roadMajor.cMin, L.roadMajor.cMax) : 0;
  const roadMajor = makeColor(clamp(roadSource.l, L.roadMajor.lMin, L.roadMajor.lMax), majorChroma, hue);
  const roadMinor = makeColor(L.roadMinor.l, majorChroma * L.roadMinor.chromaShare, hue);

  // Labels sit on land, water, park and buildings, so they must pass on the worst of them.
  const surfaces = [land, waterHex, parkHex, building];
  const label = (spec: { l: number; cMax: number; tint: number; contrast: number }) =>
    ensureContrast(makeColor(spec.l, tinted(spec.tint, spec.cMax), hue), surfaces, spec.contrast, 'darker');

  const accentCandidates = (chromatic.length > 0 ? chromatic : [undefined]).map((source) => {
    const start = source
      ? makeColor(source.l, Math.min(source.c, L.accent.cMax), source.h)
      : makeColor(L.accent.greyL, L.accent.greyChroma, config.neutralHue);
    const hex = ensureContrast(start, [land], L.accent.contrast, 'darker');
    const result = parseColor(hex)!;
    const shift = Math.abs(result.l - parseColor(start)!.l);
    return { hex, score: result.c - L.accent.lightnessPenalty * shift };
  });
  const accentHex = accentCandidates.reduce((best, candidate) => (candidate.score > best.score ? candidate : best)).hex;

  const tokens: ResolvedTokens = {
    land,
    water: waterHex,
    park: parkHex,
    roadMajor,
    roadMinor,
    building,
    boundary: makeColor(L.boundary.l, tinted(L.boundary.tint, L.boundary.cMax), hue),
    labelPrimary: label(L.labelPrimary),
    labelSecondary: label(L.labelSecondary),
    halo: makeColor(landColor.l + L.halo.lOffsetFromLand, landColor.c, landColor.h),
    accent: accentHex,
  };
  return enforceRoadGap(config.minRoadLightnessGap)(tokens);
}
