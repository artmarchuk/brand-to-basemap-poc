// Every tunable number in the palette engine lives here, so tuning needs no code changes.
// Colour values are OKLCH: l is lightness 0-1, c is chroma (0 is grey, about 0.3 is the sRGB limit).

export const PALETTE_CONFIG = {
  /** Minimum OKLCH lightness difference between roadMajor and roadMinor, in every light and dark set. */
  minRoadLightnessGap: 0.1,

  /** A brand colour with less chroma than this has no usable hue. */
  minHueChroma: 0.03,
  /** Hue used for tints and the accent when no brand colour has one (pure greys). */
  neutralHue: 255,

  /**
   * Water and park take a brand hue only when it is within `snapRange` degrees of the natural one.
   * Otherwise the natural hue moves towards the brand's by `pull` of the gap, at most `maxPullDegrees`:
   * an uncapped pull turns water violet for a red brand.
   */
  water: { hue: 240, snapRange: 40, pull: 0.3, maxPullDegrees: 15 },
  park: { hue: 140, snapRange: 40, pull: 0.3, maxPullDegrees: 15 },

  light: {
    // Large areas stay quiet: chroma is capped, and land and building only tint towards the brand.
    land: { l: 0.96, cMax: 0.012, tint: 0.1 },
    water: { l: 0.86, cMin: 0.03, cMax: 0.06 },
    park: { l: 0.9, cMin: 0.03, cMax: 0.07 },
    building: { lOffsetFromLand: -0.045, cMax: 0.015, tint: 0.12 },
    // Lines must reach 3:1 against land. On a 0.96 land that needs lightness about 0.64 or lower.
    boundary: { l: 0.56, cMax: 0.03, tint: 0.25 },
    // The brand lives in the roads: lightness follows the brand colour inside this band.
    roadMajor: { lMin: 0.5, lMax: 0.62, cMin: 0.08, cMax: 0.2 },
    roadMinor: { l: 0.84, chromaShare: 0.45 },
    labelPrimary: { l: 0.26, cMax: 0.03, tint: 0.2, contrast: 7 },
    labelSecondary: { l: 0.46, cMax: 0.03, tint: 0.2, contrast: 4.5 },
    halo: { lOffsetFromLand: 0.02 },
    // The accent is the brand colour that keeps the most chroma after reaching `contrast`, with each
    // unit of lightness moved costing `lightnessPenalty` chroma. Greys get a blue at `greyL`.
    accent: { cMax: 0.22, contrast: 4.5, lightnessPenalty: 0.5, greyL: 0.5, greyChroma: 0.12 },
  },

  dark: {
    land: { l: 0.22, cMax: 0.02, cScale: 1.5 },
    water: { l: 0.15, cMin: 0.04, cMax: 0.07, cScale: 1 },
    park: { l: 0.265, cMin: 0.03, cMax: 0.05, cScale: 0.8 },
    building: { lOffsetFromLand: 0.1, cMax: 0.02, cScale: 1.5 },
    boundary: { l: 0.56, cScale: 1 },
    // Chroma floors keep dark maps from turning grey-muddy for chromatic brands.
    roadMajor: { l: 0.66, cMin: 0.07, cScale: 0.9 },
    roadMinor: { l: 0.42, cScale: 0.9 },
    labelPrimary: { l: 0.9, contrast: 7 },
    labelSecondary: { l: 0.72, contrast: 4.5 },
    halo: { lOffsetFromLand: -0.03 },
    accent: { lMin: 0.7, cMin: 0.08, contrast: 4.5 },
  },

  data: {
    /** Chroma left on fills and lines at recede 100. */
    minChromaShare: 0.2,
    /** Share of the distance to the common lightness covered at recede 100. */
    lightnessPull: 0.6,
    /** Recede values above which these hints switch on. */
    hidePoisAbove: 30,
    thinLabelsAbove: 60,
  },
};

export type PaletteConfig = typeof PALETTE_CONFIG;
