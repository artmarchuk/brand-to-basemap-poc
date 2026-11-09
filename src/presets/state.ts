import { normalizeHex } from '../palette/brand';
import { PaletteError } from '../palette/errors';
import { normalizeOverrides, type Overrides } from '../palette/state';
import type { TokenName } from '../tokens/types';
import { getPreset, PRESETS, primarySlot, type PresetId } from './registry';

/** Version 2: presets. Version 1 (brand colours, light/dark/data) stays in src/palette and is not wired. */
export const PRESET_STATE_VERSION = 2;

/** Dark is out while presets are on. */
export type PresetMode = 'light' | 'data';
export const PRESET_MODES: PresetMode[] = ['light', 'data'];

/** Everything the preset pipeline needs. Plain JSON, so it can be stored or put in a URL as it is. */
export interface PresetState {
  version: typeof PRESET_STATE_VERSION;
  preset: PresetId;
  /** Only the slots the user set. The primary slot is always set; the rest fall back to the preset's defaults. */
  slots: Record<string, string>;
  mode: PresetMode;
  /** 0-100, used in data mode. */
  recede: number;
  /** Per-token overrides for the active preset, per mode. Cleared when the preset changes. */
  overrides: Record<PresetMode, Overrides>;
}

const EMPTY_OVERRIDES = (): Record<PresetMode, Overrides> => ({ light: {}, data: {} });

export function createPresetState(presetId: PresetId, primary: string): PresetState {
  const preset = getPreset(presetId);
  return {
    version: PRESET_STATE_VERSION,
    preset: preset.id,
    slots: { [primarySlot(preset).id]: normalizeHex(primary) },
    mode: 'light',
    recede: 60,
    overrides: EMPTY_OVERRIDES(),
  };
}

/** The preset's own sample palette, every slot set. */
export function samplePresetState(presetId: PresetId): PresetState {
  const preset = getPreset(presetId);
  const state = createPresetState(presetId, preset.sample[primarySlot(preset).id]);
  return { ...state, slots: Object.fromEntries(Object.entries(preset.sample).map(([slot, hex]) => [slot, normalizeHex(hex)])) };
}

export const primaryColour = (state: PresetState) => state.slots[primarySlot(getPreset(state.preset)).id];

/** Keeps the primary colour. Other slots reset to the new preset's defaults, and overrides are cleared. */
export function switchPreset(state: PresetState, presetId: PresetId): PresetState {
  if (presetId === state.preset) return state;
  return { ...createPresetState(presetId, primaryColour(state)), mode: state.mode, recede: state.recede };
}

export function setSlot(state: PresetState, slot: string, hex: string): PresetState {
  if (!getPreset(state.preset).slots.some((candidate) => candidate.id === slot)) {
    throw new PaletteError('invalid-state', `No slot "${slot}" in ${state.preset}`);
  }
  return { ...state, slots: { ...state.slots, [slot]: normalizeHex(hex) } };
}

/** Back to the slot's default. The primary slot cannot be cleared. */
export function clearSlot(state: PresetState, slot: string): PresetState {
  if (slot === primarySlot(getPreset(state.preset)).id) return state;
  const slots = { ...state.slots };
  delete slots[slot];
  return { ...state, slots };
}

export const setPresetOverride = (state: PresetState, token: TokenName, hex: string): PresetState => ({
  ...state,
  overrides: { ...state.overrides, [state.mode]: { ...state.overrides[state.mode], [token]: normalizeHex(hex) } },
});

export function resetPresetOverride(state: PresetState, token: TokenName): PresetState {
  const rest = { ...state.overrides[state.mode] };
  delete rest[token];
  return { ...state, overrides: { ...state.overrides, [state.mode]: rest } };
}

export const resetPresetOverrides = (state: PresetState): PresetState => ({ ...state, overrides: EMPTY_OVERRIDES() });

/** Checks untrusted input, such as a decoded URL. Returns a clean state or throws PaletteError. */
export function parsePresetState(raw: unknown): PresetState {
  const input = raw as Partial<PresetState> | null;
  if (!input || typeof input !== 'object') throw new PaletteError('invalid-state', 'State must be an object');
  if (input.version !== PRESET_STATE_VERSION) throw new PaletteError('invalid-state', `Unsupported state version: ${String(input.version)}`);
  if (!PRESETS.some((preset) => preset.id === input.preset)) throw new PaletteError('invalid-state', `Unknown preset: ${String(input.preset)}`);
  if (!PRESET_MODES.includes(input.mode as PresetMode)) throw new PaletteError('invalid-state', `Unknown mode: ${String(input.mode)}`);
  if (typeof input.recede !== 'number' || !Number.isFinite(input.recede)) throw new PaletteError('invalid-state', 'Recede must be a number');
  const preset = getPreset(input.preset!);
  const slots: Record<string, string> = {};
  for (const [slot, hex] of Object.entries(input.slots ?? {})) {
    if (!preset.slots.some((candidate) => candidate.id === slot)) throw new PaletteError('invalid-state', `No slot "${slot}" in ${preset.id}`);
    slots[slot] = normalizeHex(hex);
  }
  if (!slots[primarySlot(preset).id]) throw new PaletteError('invalid-state', 'The primary colour is required');
  const overrides = input.overrides as Record<string, unknown> | undefined;
  return {
    version: PRESET_STATE_VERSION,
    preset: preset.id,
    slots,
    mode: input.mode as PresetMode,
    recede: Math.min(100, Math.max(0, input.recede)),
    overrides: { light: normalizeOverrides(overrides?.light ?? {}), data: normalizeOverrides(overrides?.data ?? {}) },
  };
}
