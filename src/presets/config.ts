// Every tunable number in the preset engine that is not in a preset file. Colours are OKLCH:
// l is lightness 0-1, c is chroma (0 is grey, about 0.3 is the sRGB limit), h is hue in degrees.
import type { WidthStops } from '../style/treatment';

export const PRESET_CONFIG = {
  functions: {
    /** dark(x): x at this lightness, hue and chroma kept where the gamut allows. */
    dark: { l: 0.3 },
    /** light(x): a near-white at x's hue, chroma at most `cMax` so it reads as paper. */
    light: { l: 0.97, cMax: 0.012 },
    /** complement(x): hue turned 180°, same lightness and chroma, then moved in lightness until `contrast` against x. */
    complement: { contrast: 3 },
    /**
     * waterFor(x): Figure-Ground's derived water. The hue nearest `hue` (a water blue) that is at least
     * `minHueGap` degrees from x, at lightness `l`, with chroma a share of x's inside a band.
     */
    waterFor: { hue: 225, minHueGap: 90, l: 0.8, chromaShare: 0.5, cMin: 0.04, cMax: 0.09 },
  },

  /** Road weights a preset can name. Pixels per zoom, drawn as an exponential 1.2 ramp. */
  weights: {
    hairline: [[12, 0.4], [14, 0.7], [16, 1], [20, 2.5]] as WidthStops,
    medium: [[5, 0.5], [8, 1], [12, 1.8], [16, 3.5], [20, 8]] as WidthStops,
  },
  /** A hairline casing is its road's width plus this many pixels, so about half of it shows each side. */
  casingHairlinePx: 1.2,

  data: {
    /** Share of a non-label check's minimum still required at recede 100, as the F5 road rule (3:1 to 1.5:1). */
    relaxTo: 0.5,
  },

  autoFix: {
    /** Lightness step when a fix moves a slot or a token. */
    step: 0.005,
    /** Most times the slot pass repeats when one slot fix breaks an earlier check. */
    slotRounds: 3,
  },
};

export type PresetConfig = typeof PRESET_CONFIG;
export type WeightName = keyof PresetConfig['weights'];
