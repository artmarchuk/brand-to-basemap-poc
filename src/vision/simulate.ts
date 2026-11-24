// Colour-vision simulation, for the preview filter on the map and for docs/colour-vision.md.
// Preview only: nothing here feeds the tokens, the state, the share link or the exports.
import { rgbKey } from '../tokens/color';

export const VISION_MODES = ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'] as const;
export type VisionMode = (typeof VISION_MODES)[number];
export type Simulation = Exclude<VisionMode, 'none'>;
export const SIMULATIONS = VISION_MODES.filter((mode): mode is Simulation => mode !== 'none');

export const VISION_LABELS: Record<VisionMode, string> = {
  none: 'None',
  protanopia: 'Protanopia (no red cones)',
  deuteranopia: 'Deuteranopia (no green cones)',
  tritanopia: 'Tritanopia (no blue cones)',
  achromatopsia: 'Achromatopsia (no colour)',
};

type Row = [number, number, number];
type Matrix = [Row, Row, Row];

/**
 * 3x3 matrices on linear RGB. The dichromacies are Machado, Oliveira and Fernandes (2009), "A
 * Physiologically-based Model for Simulation of Color Vision Deficiency", at severity 1.0. Achromatopsia
 * is relative luminance (Rec. 709 weights) on every channel.
 */
export const VISION_MATRICES: Record<Simulation, Matrix> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
  achromatopsia: [
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
  ],
};

/** The DOM id of a simulation's SVG filter. */
export const visionFilterId = (mode: Simulation) => `b2b-vision-${mode}`;

/** The 20 numbers of an SVG `feColorMatrix type="matrix"`: the 3x3 with alpha passed through. */
export function feColorMatrixValues(mode: Simulation): string {
  const [r, g, b] = VISION_MATRICES[mode];
  return [...r, 0, 0, ...g, 0, 0, ...b, 0, 0, 0, 0, 0, 1, 0].join(' ');
}

const toLinear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const toSrgb = (channel: number) => (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** One sRGB pixel (0-255 per channel) as the filter draws it: linearise, matrix, clamp, back to sRGB. */
export function simulateRgb(rgb: [number, number, number], mode: VisionMode): [number, number, number] {
  if (mode === 'none') return rgb;
  const linear = rgb.map((channel) => toLinear(channel / 255));
  return VISION_MATRICES[mode].map((row) =>
    Math.round(toSrgb(clamp01(row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2])) * 255),
  ) as [number, number, number];
}

/** A colour as it appears under a simulation, as hex. */
export function simulate(colour: string, mode: VisionMode): string {
  const hex = rgbKey(colour);
  if (!hex) throw new Error(`Invalid colour: ${colour}`);
  if (mode === 'none') return hex;
  const rgb = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];
  return `#${simulateRgb(rgb, mode).map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
